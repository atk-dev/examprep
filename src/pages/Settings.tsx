import { useRef, useState } from 'react';
import { db } from '../db/db';
import { saveSettings } from '../db/actions';
import { exportBackup, importBackup, parseBackup } from '../db/backup';
import { TH_WEEKDAYS, todayISO } from '../logic/dates';
import { defaultPhases } from '../logic/plan';
import { reminderICS } from '../logic/reminders';
import TopicEditor from '../components/TopicEditor';
import type { AppData } from '../hooks/useAppData';
import type { Settings } from '../types';

export default function SettingsPage({ data }: { data: AppData }) {
  const [s, setS] = useState<Settings>(data.settings!);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // lastBackupAt changes on export; it isn't something the form edits
  const strip = (x: Settings) => ({ ...x, lastBackupAt: undefined, mockMinutesPerProblem: undefined });
  const dirty = JSON.stringify(strip(s)) !== JSON.stringify(strip(data.settings!));
  const pinValid = s.parentPin.length === 0 || s.parentPin.length === 4;
  const phasesValid = s.startDate <= s.phase1End && s.phase1End < s.phase2End && s.phase2End < s.phase3End && s.phase3End < s.examDate;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  };

  function download(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function doExport() {
    const b = await exportBackup(db);
    download(new Blob([JSON.stringify(b)], { type: 'application/json' }), `examprep-backup-${todayISO()}.json`);
    await db.settings.update('main', { lastBackupAt: Date.now() });
  }

  async function doReminder() {
    const reminderTime = s.reminderTime ?? '19:00';
    const settings = { ...data.settings!, reminderTime };
    const appUrl = location.href.split('#')[0];
    download(new Blob([reminderICS(settings, todayISO(), appUrl)], { type: 'text/calendar' }), 'examprep-reminder.ics');
    await db.settings.update('main', { reminderTime });
  }

  async function doImport(file: File) {
    try {
      const b = parseBackup(await file.text());
      if (!confirm('ข้อมูลปัจจุบันจะถูกแทนที่ด้วยไฟล์สำรอง ดำเนินการต่อ?')) return;
      await importBackup(db, b);
      if (b.data.settings[0]) setS(b.data.settings[0] as Settings);
      flash('นำเข้าข้อมูลแล้ว ✓');
    } catch (e) {
      flash(`นำเข้าไม่สำเร็จ: ${(e as Error).message}`);
    }
  }

  async function resetAll() {
    if (!confirm('ลบข้อมูลทั้งหมดและเริ่มใหม่? (แนะนำให้สำรองข้อมูลก่อน)')) return;
    await Promise.all(db.tables.map((t) => t.clear()));
    location.reload();
  }

  const dateRow = (label: string, key: keyof Settings) => (
    <div>
      <label className="label" htmlFor={`set-${key}`}>{label}</label>
      <input id={`set-${key}`} type="date" className="input" value={s[key] as string} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </div>
  );

  return (
    <>
      <h1 className="text-xl font-bold">⚙️ ตั้งค่า</h1>

      <section className="card space-y-3">
        <h2 className="font-bold">การสอบและแผน</h2>
        <div>
          <label className="label" htmlFor="set-examName">ชื่อการสอบ</label>
          <input id="set-examName" className="input" value={s.examName} onChange={(e) => setS({ ...s, examName: e.target.value })} />
        </div>
        {dateRow('วันสอบ', 'examDate')}
        <div className="grid grid-cols-2 gap-3">
          {dateRow('วันเริ่มแผน', 'startDate')}
          {dateRow('จบรอบแรก', 'phase1End')}
          {dateRow('จบช่วงแก้จุดอ่อน', 'phase2End')}
          {dateRow('จบช่วงฝึกจับเวลา', 'phase3End')}
        </div>
        <button className="text-sm text-indigo-600 underline" onClick={() => setS({ ...s, ...defaultPhases(s.examDate) })}>
          คำนวณช่วงจากวันสอบใหม่
        </button>
        <div>
          <label className="label">วันพักประจำสัปดาห์</label>
          <div className="flex flex-wrap gap-2">
            {TH_WEEKDAYS.map((w, i) => (
              <button
                key={i}
                className={`btn py-1.5 ${s.restWeekdays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() =>
                  setS({ ...s, restWeekdays: s.restWeekdays.includes(i) ? s.restWeekdays.filter((x) => x !== i) : [...s.restWeekdays, i] })
                }
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="set-pin">รหัส PIN หน้าผู้ปกครอง (4 หลัก, เว้นว่าง = ไม่ล็อก)</label>
          <input
            id="set-pin"
            className="input"
            inputMode="numeric"
            maxLength={4}
            value={s.parentPin}
            onChange={(e) => setS({ ...s, parentPin: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        {!pinValid && <p className="text-sm text-rose-600">รหัส PIN ต้องมี 4 หลัก หรือเว้นว่าง</p>}
        {!phasesValid && <p className="text-sm text-rose-600">ลำดับวันที่ไม่ถูกต้อง: เริ่ม ≤ รอบแรก &lt; แก้จุดอ่อน &lt; ฝึกจับเวลา &lt; วันสอบ</p>}
        <button
          className="btn-primary w-full"
          disabled={!dirty || !phasesValid || !pinValid}
          onClick={async () => {
            await saveSettings(db, { ...s, lastBackupAt: data.settings!.lastBackupAt, mockMinutesPerProblem: data.settings!.mockMinutesPerProblem });
            flash('บันทึกการตั้งค่าแล้ว ✓');
          }}
        >
          บันทึกการตั้งค่า
        </button>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">หัวข้อในแต่ละวิชา</h2>
        <p className="text-sm text-slate-500">บรรทัดละหัวข้อ: ชื่อหัวข้อ, จำนวนข้อ — เปลี่ยนจำนวนข้อได้โดยไม่เสียประวัติ</p>
        {data.subjects.map((sub) => {
          const ts = data.topics.filter((t) => t.subjectId === sub.id);
          return (
            <div key={sub.id} className="rounded-xl bg-slate-50 p-3">
              <button className="flex w-full justify-between" onClick={() => setOpen(open === sub.id ? null : sub.id!)}>
                <span className="font-semibold">{sub.name}</span>
                <span className="text-sm text-slate-500">
                  {ts.length} หัวข้อ · {ts.reduce((n, t) => n + t.problemCount, 0)} ข้อ {open === sub.id ? '▲' : '▼'}
                </span>
              </button>
              {open === sub.id && (
                <div className="mt-2">
                  <TopicEditor subject={sub} topics={ts} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">แจ้งเตือน</h2>
        <p className="text-sm text-slate-500">
          เพิ่มนัด "ตะลุยโจทย์" ทุกวัน (ยกเว้นวันพัก) จนถึงวันสอบลงในปฏิทินของโทรศัพท์ ปฏิทินจะเตือนให้แม้ไม่ได้เปิดแอป
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="set-reminder">เวลาเตือน</label>
            <input
              id="set-reminder"
              type="time"
              className="input"
              value={s.reminderTime ?? '19:00'}
              onChange={(e) => setS({ ...s, reminderTime: e.target.value })}
            />
          </div>
          <button className="btn-primary" onClick={doReminder}>📅 เพิ่มลงปฏิทิน</button>
        </div>
        <p className="text-xs text-slate-400">ถ้าเปลี่ยนเวลา ให้ลบนัดเดิมในปฏิทินก่อนเพิ่มใหม่</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">สำรองข้อมูล</h2>
        <p className="text-sm text-slate-500">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ควรสำรองทุกสัปดาห์ หรือใช้ย้ายไปเครื่องอื่น</p>
        <p className="text-xs text-slate-400">
          สำรองล่าสุด: {data.settings!.lastBackupAt ? new Date(data.settings!.lastBackupAt).toLocaleString('th-TH') : 'ยังไม่เคย'}
        </p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={doExport}>⬇️ ส่งออก</button>
          <button className="btn-ghost flex-1" onClick={() => fileRef.current?.click()}>⬆️ นำเข้า</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <button className="w-full pt-2 text-sm text-rose-600 underline" onClick={resetAll}>ลบข้อมูลทั้งหมด</button>
      </section>

      {msg && (
        <div className="fixed inset-x-4 top-4 z-20 mx-auto max-w-md rounded-xl bg-slate-900 p-3 text-center text-white shadow-lg">{msg}</div>
      )}
    </>
  );
}
