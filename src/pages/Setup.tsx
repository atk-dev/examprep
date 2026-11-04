import { GraduationCap, Rocket, Sparkles } from 'lucide-react';
import { ICON } from '../components/ui';
import { useRef, useState } from 'react';
import { importBackup, readBackupFile } from '../db/backup';
import { db } from '../db/db';
import { defaultSettings, DEFAULT_EXAM_DATE } from '../db/defaults';
import { replaceTopics, saveSettings } from '../db/actions';
import { DEFAULT_TEMPLATE_COUNT, MAX_TEMPLATE_COUNT, clampCount, templateFor, templateItems } from '../db/templates';
import { defaultPhases, studyDaysBetween } from '../logic/plan';
import { TH_WEEKDAYS, todayISO } from '../logic/dates';
import TopicEditor from '../components/TopicEditor';
import { BankImport, PlanImport } from '../components/ImportPanels';
import { PencilRuler } from 'lucide-react';
import type { AppData } from '../hooks/useAppData';

function CustomSetup({ data, onBack }: { data: AppData; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [examName, setExamName] = useState(data.settings?.examName ?? 'สอบเข้า ม.1');
  const [examDate, setExamDate] = useState(data.settings?.examDate ?? DEFAULT_EXAM_DATE);
  const [rest, setRest] = useState<number[]>(data.settings?.restWeekdays ?? []);
  // undefined = default to the first subject (subjects may still be seeding on first render)
  const [openState, setOpen] = useState<number | null | undefined>(undefined);
  const open = openState === undefined ? (data.subjects[0]?.id ?? null) : openState;

  const fileRef = useRef<HTMLInputElement>(null);
  const [tplCount, setTplCount] = useState(String(DEFAULT_TEMPLATE_COUNT));
  const emptyWithTemplate = data.subjects.filter((s) => templateFor(s.name) && !data.topics.some((t) => t.subjectId === s.id));

  /** Fill sample topics into every subject that has none yet; subjects already set up are left alone. */
  async function fillAllTemplates() {
    const n = clampCount(tplCount);
    for (const s of emptyWithTemplate) await replaceTopics(db, s.id!, templateItems(templateFor(s.name)!, n));
  }
  const [importError, setImportError] = useState('');

  async function restore(file: File) {
    try {
      const { backup, figures } = readBackupFile(new Uint8Array(await file.arrayBuffer()));
      await importBackup(db, backup, figures);
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
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-primary text-on-primary shadow-[0_6px_0_0_var(--color-primary-strong)]">
          <GraduationCap size={40} aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-bold">ตะลุยโจทย์สอบเข้า ม.1</h1>
        <p className="mt-1 text-muted-fg">ตั้งค่าเริ่มต้น ขั้นที่ {step + 1} จาก 3</p>
        <div className="mx-auto mt-3 flex max-w-40 gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>
      </header>

      {step === 0 && (
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="setup-name">ชื่อการสอบ</label>
            <input id="setup-name" className="input" value={examName} onChange={(e) => setExamName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="setup-date">วันสอบ</label>
            <input id="setup-date" type="date" className="input" value={examDate} min={today} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onBack}>ย้อนกลับ</button>
            <button className="btn-primary flex-1" disabled={!examDate || examDate <= today} onClick={() => setStep(1)}>
              ถัดไป
            </button>
          </div>
          <div className="border-t border-muted pt-3 text-center">
            <button className="min-h-11 text-sm font-semibold text-primary underline" onClick={() => fileRef.current?.click()}>
              มีไฟล์สำรองข้อมูลอยู่แล้ว? กู้คืนข้อมูล
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json,application/zip,.zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restore(f);
                e.target.value = '';
              }}
            />
            {importError && <p className="mt-1 text-sm text-danger">{importError}</p>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="card text-sm text-muted-fg">
            ใส่หัวข้อตามหนังสือ บรรทัดละหัวข้อ: <b>ชื่อหัวข้อ, จำนวนข้อ</b>
            <br />
            ข้อในแต่ละหัวข้อนับ 1, 2, 3… ตามเลขในหนังสือ แก้ไขภายหลังได้ที่หน้าตั้งค่า
          </div>
          {emptyWithTemplate.length > 0 && (
            <div className="card space-y-2 ring-2 ring-border">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles size={ICON.md} className="text-primary" aria-hidden /> เริ่มเร็ว: ใช้หัวข้อตัวอย่าง</h2>
              <p className="text-sm text-muted-fg">
                ใส่หัวข้อตามหลักสูตร ป.4–6 ให้ {emptyWithTemplate.length} วิชาที่ยังว่าง แล้วค่อยแก้ให้ตรงกับหนังสือ
              </p>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-1">
                  หัวข้อละ
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_TEMPLATE_COUNT}
                    className="input w-20 py-1 text-center"
                    value={tplCount}
                    onChange={(e) => setTplCount(e.target.value)}
                    aria-label="จำนวนข้อต่อหัวข้อ ทุกวิชา"
                  />
                  ข้อ
                </label>
                <button className="btn-primary py-1.5" onClick={fillAllTemplates}>ใส่ให้ทุกวิชา</button>
              </div>
            </div>
          )}
          {data.subjects.map((s) => {
            const ts = data.topics.filter((t) => t.subjectId === s.id);
            const n = ts.reduce((a, t) => a + t.problemCount, 0);
            return (
              <div key={s.id} className="card">
                <button className="flex min-h-11 w-full items-center justify-between" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id!)}>
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-sm text-muted-fg">
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
          <div className="text-center text-sm text-muted-fg">
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
                  className="chip min-w-12 justify-center"
                  aria-pressed={rest.includes(i)}
                  onClick={() => setRest(rest.includes(i) ? rest.filter((x) => x !== i) : [...rest, i])}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 text-sm text-fg">
            รอบแรกมี <b>{days}</b> วันเรียน ต้องทำประมาณ{' '}
            <b>{Math.ceil(data.topics.reduce((a, t) => a + t.problemCount, 0) / Math.max(days, 1))}</b> ข้อ/วัน
            <br />
            แอปจะปรับโควต้าให้อัตโนมัติทุกวันตามที่ทำได้จริง
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setStep(1)}>ย้อนกลับ</button>
            <button className="btn-cta flex-1" onClick={finish}><Rocket size={ICON.md} aria-hidden /> เริ่มเลย</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="pt-4 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-primary text-on-primary shadow-[0_6px_0_0_var(--color-primary-strong)]">
        <GraduationCap size={40} aria-hidden />
      </span>
      <h1 className="mt-4 text-3xl font-bold">ตะลุยโจทย์สอบเข้า ม.1</h1>
      <p className="mt-1 text-muted-fg">{subtitle}</p>
    </header>
  );
}

/** After a plan is applied: profile, then the optional question bank. */
function PlanSetup({ data }: { data: AppData }) {
  const s = data.settings!;
  const [step, setStep] = useState<'profile' | 'bank'>('profile');
  const [name, setName] = useState(s.profile?.studentName ?? '');
  const [target, setTarget] = useState(s.profile?.targetScore ? String(s.profile.targetScore) : '');
  const [teacher, setTeacher] = useState(s.profile?.teacherName ?? '');
  const max = data.plan?.exam.totalScore ?? 200;

  async function saveProfile() {
    const t = Math.round(Number(target));
    await db.settings.update('main', {
      profile: { ...s.profile, studentName: name.trim(), teacherName: teacher.trim(), targetScore: t > 0 ? Math.min(t, max) : null },
    });
    setStep('bank');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Header subtitle={`${data.plan?.title ?? 'แผนการเรียน'} · ${step === 'profile' ? 'ข้อมูลนักเรียน' : 'คลังข้อสอบ'}`} />
      {step === 'profile' ? (
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="p-name">ชื่อนักเรียน</label>
            <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label className="label" htmlFor="p-target">เป้าหมายคะแนนรวม (เต็ม {max})</label>
            <input id="p-target" className="input" inputMode="numeric" type="number" min={0} max={max} value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-teacher">ครูผู้สอน</label>
            <input id="p-teacher" className="input" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </div>
          <button className="btn-primary w-full" onClick={saveProfile}>ถัดไป</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="card space-y-2 text-sm">
            <p>นำเข้าคลังข้อสอบ (โจทย์ + เฉลย) เพื่อทำโจทย์ในแอปได้เลย ข้ามได้ถ้ายังไม่มีไฟล์ จะบันทึกจากหนังสือเป็นเลขข้อแทน</p>
            <p className="text-muted-fg">นำเข้าภายหลังได้ที่หน้าตั้งค่า</p>
          </div>
          <BankImport />
          <button className="btn-cta w-full" onClick={() => db.settings.update('main', { setupDone: true })}>
            <Rocket size={ICON.md} aria-hidden /> {data.questions.length ? 'เริ่มเลย' : 'ข้ามไปก่อน · เริ่มเลย'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Setup({ data }: { data: AppData }) {
  const [custom, setCustom] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  if (data.settings?.planMode === 'plan' && data.plan) return <PlanSetup data={data} />;
  if (custom) return <CustomSetup data={data} onBack={() => setCustom(false)} />;

  async function restore(file: File) {
    try {
      const { backup, figures } = readBackupFile(new Uint8Array(await file.arrayBuffer()));
      await importBackup(db, backup, figures);
    } catch (e) {
      setImportError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Header subtitle="เริ่มจากแผนการเรียน" />
      <PlanImport hasData={data.attempts.length > 0} />
      <button className="card flex w-full items-center gap-3 text-left" onClick={() => setCustom(true)}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><PencilRuler size={ICON.lg} aria-hidden /></span>
        <span>
          <span className="block font-display text-lg font-bold">สร้างแผนเอง</span>
          <span className="block text-sm text-muted-fg">ตั้งวันสอบ ใส่หัวข้อเอง แอปคำนวณโควต้าต่อวันให้</span>
        </span>
      </button>
      <div className="text-center">
        <button className="min-h-11 text-sm font-semibold text-primary underline" onClick={() => fileRef.current?.click()}>
          มีไฟล์สำรองข้อมูลอยู่แล้ว? กู้คืนข้อมูล
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json,application/zip,.zip" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        {importError && <p className="mt-1 text-sm text-danger" role="alert">{importError}</p>}
      </div>
    </div>
  );
}
