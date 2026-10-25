import { useRef, useState } from 'react';
import { importBackup, parseBackup } from '../db/backup';
import { db } from '../db/db';
import { defaultSettings, DEFAULT_EXAM_DATE } from '../db/defaults';
import { saveSettings } from '../db/actions';
import { defaultPhases, studyDaysBetween } from '../logic/plan';
import { TH_WEEKDAYS, todayISO } from '../logic/dates';
import TopicEditor from '../components/TopicEditor';
import type { AppData } from '../hooks/useAppData';

export default function Setup({ data }: { data: AppData }) {
  const [step, setStep] = useState(0);
  const [examName, setExamName] = useState(data.settings?.examName ?? 'สอบเข้า ม.1');
  const [examDate, setExamDate] = useState(data.settings?.examDate ?? DEFAULT_EXAM_DATE);
  const [rest, setRest] = useState<number[]>(data.settings?.restWeekdays ?? []);
  // undefined = default to the first subject (subjects may still be seeding on first render)
  const [openState, setOpen] = useState<number | null | undefined>(undefined);
  const open = openState === undefined ? (data.subjects[0]?.id ?? null) : openState;

  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  async function restore(file: File) {
    try {
      await importBackup(db, parseBackup(await file.text()));
    } catch (e) {
      setImportError((e as Error).message);
    }
  }

  const today = todayISO();
  const phase1End = defaultPhases(examDate).phase1End;
  const days = studyDaysBetween(today, phase1End, rest);

  async function finish() {
    await saveSettings(db, {
      ...defaultSettings(today, examDate),
      examName,
      restWeekdays: rest,
      setupDone: true,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="pt-4 text-center">
        <div className="text-4xl">📚</div>
        <h1 className="mt-2 text-2xl font-bold">ตะลุยโจทย์สอบเข้า ม.1</h1>
        <p className="text-slate-500">ตั้งค่าเริ่มต้น ขั้นที่ {step + 1} / 3</p>
      </header>

      {step === 0 && (
        <div className="card space-y-4">
          <div>
            <label className="label">ชื่อการสอบ</label>
            <input className="input" value={examName} onChange={(e) => setExamName(e.target.value)} />
          </div>
          <div>
            <label className="label">วันสอบ</label>
            <input type="date" className="input" value={examDate} min={today} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={!examDate || examDate <= today} onClick={() => setStep(1)}>
            ถัดไป
          </button>
          <div className="border-t border-slate-100 pt-3 text-center">
            <button className="text-sm text-indigo-600 underline" onClick={() => fileRef.current?.click()}>
              มีไฟล์สำรองข้อมูลอยู่แล้ว? กู้คืนข้อมูล
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restore(f);
                e.target.value = '';
              }}
            />
            {importError && <p className="mt-1 text-sm text-rose-600">{importError}</p>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="card text-sm text-slate-600">
            ใส่หัวข้อตามหนังสือ บรรทัดละหัวข้อ: <b>ชื่อหัวข้อ, จำนวนข้อ</b>
            <br />
            ข้อในแต่ละหัวข้อนับ 1, 2, 3… ตามเลขในหนังสือ แก้ไขภายหลังได้ที่หน้าตั้งค่า
          </div>
          {data.subjects.map((s) => {
            const ts = data.topics.filter((t) => t.subjectId === s.id);
            const n = ts.reduce((a, t) => a + t.problemCount, 0);
            return (
              <div key={s.id} className="card">
                <button className="flex w-full items-center justify-between" onClick={() => setOpen(open === s.id ? null : s.id!)}>
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-sm text-slate-500">
                    {ts.length} หัวข้อ · {n} ข้อ {open === s.id ? '▲' : '▼'}
                  </span>
                </button>
                {open === s.id && (
                  <div className="mt-3">
                    <TopicEditor subject={s} topics={ts} />
                  </div>
                )}
              </div>
            );
          })}
          <div className="text-center text-sm text-slate-600">
            รวมทั้งหมด <b>{data.topics.reduce((a, t) => a + t.problemCount, 0)}</b> ข้อ
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setStep(0)}>ย้อนกลับ</button>
            <button className="btn-primary flex-1" disabled={!data.topics.length} onClick={() => setStep(2)}>
              ถัดไป
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <div>
            <label className="label">วันพักประจำสัปดาห์ (ไม่นับโควต้า)</label>
            <div className="flex flex-wrap gap-2">
              {TH_WEEKDAYS.map((w, i) => (
                <button
                  key={i}
                  className={`btn py-1.5 ${rest.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => setRest(rest.includes(i) ? rest.filter((x) => x !== i) : [...rest, i])}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
            รอบแรกมี <b>{days}</b> วันเรียน ต้องทำประมาณ{' '}
            <b>{Math.ceil(data.topics.reduce((a, t) => a + t.problemCount, 0) / Math.max(days, 1))}</b> ข้อ/วัน
            <br />
            แอปจะปรับโควต้าให้อัตโนมัติทุกวันตามที่ทำได้จริง
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setStep(1)}>ย้อนกลับ</button>
            <button className="btn-primary flex-1" onClick={finish}>เริ่มเลย 🚀</button>
          </div>
        </div>
      )}
    </div>
  );
}
