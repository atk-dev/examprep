import { useRef, useState } from 'react';
import { CalendarDays, FileUp, Library, TriangleAlert } from 'lucide-react';
import { db } from '../db/db';
import { exportBackupZip } from '../db/backup';
import { formatThai, todayISO } from '../logic/dates';
import { applyPlan, fetchBundledPlan } from '../plan/importPlan';
import { validatePlan, type PlanFile } from '../plan/planSchema';
import { applyBank, readBank, shrinkImage, type BankRead } from '../plan/importBank';
import { ICON } from './ui';

const SUBJECT_TH: Record<string, string> = { math: 'คณิต', thai: 'ไทย', science: 'วิทย์', english: 'อังกฤษ', social: 'สังคม' };

function download(bytes: Uint8Array, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="space-y-1 rounded-2xl bg-danger-bg p-3 text-sm text-danger">
      <p className="flex items-center gap-1.5 font-bold"><TriangleAlert size={ICON.sm} aria-hidden /> ไฟล์มีปัญหา {errors.length} จุด</p>
      <ul className="list-disc space-y-0.5 pl-5 break-words">{errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

/** Pick the bundled teacher plan or upload a plan JSON, preview it, then apply. */
export function PlanImport({ hasData, onApplied }: { hasData: boolean; onApplied?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<PlanFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function check(raw: unknown) {
    const r = validatePlan(raw);
    setErrors(r.errors);
    setPlan(r.plan);
  }

  async function loadBundled() {
    setBusy(true);
    try {
      check(await fetchBundledPlan());
    } catch (e) {
      setErrors([(e as Error).message]);
    }
    setBusy(false);
  }

  async function loadFile(f: File) {
    try {
      check(JSON.parse(await f.text()));
    } catch {
      setErrors(['ไฟล์ไม่ใช่ JSON ที่ถูกต้อง']);
      setPlan(null);
    }
  }

  async function apply() {
    if (!plan) return;
    if (hasData && !confirm('ข้อมูลการทำโจทย์เดิมจะถูกแทนที่ด้วยแผนใหม่ ดำเนินการต่อ? (แนะนำให้สำรองข้อมูลก่อน)')) return;
    setBusy(true);
    await applyPlan(db, plan, await db.settings.get('main'));
    setBusy(false);
    setPlan(null);
    onApplied?.();
  }

  const dates = plan?.tasks.map((t) => t.date).sort();
  return (
    <div className="space-y-3">
      {!plan && (
        <>
          <button className="card flex w-full items-center gap-3 text-left ring-2 ring-primary/30" onClick={loadBundled} disabled={busy}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary"><CalendarDays size={ICON.lg} aria-hidden /></span>
            <span>
              <span className="block font-display text-lg font-bold">ใช้แผนของครู</span>
              <span className="block text-sm text-muted-fg">ปฏิทินเตรียมสอบเข้า ม.1 · 9 พ.ย. 69 – สอบ 27 มี.ค. 70</span>
            </span>
          </button>
          <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
            <FileUp size={ICON.md} aria-hidden /> อัปโหลดแผนอื่น (JSON)
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
        </>
      )}
      <Errors errors={errors} />
      {plan && dates && (
        <section className="card space-y-3" aria-live="polite">
          <h3 className="text-lg font-bold">{plan.title}</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-muted/60 p-2.5"><dt className="text-muted-fg">วันสอบ</dt><dd className="font-bold">{formatThai(plan.exam.date)}</dd></div>
            <div className="rounded-2xl bg-muted/60 p-2.5"><dt className="text-muted-fg">ช่วงแผน</dt><dd className="font-bold">{formatThai(dates[0])} – {formatThai(dates[dates.length - 1])}</dd></div>
            <div className="rounded-2xl bg-muted/60 p-2.5"><dt className="text-muted-fg">ชุดโจทย์</dt><dd className="font-bold">{plan.sets.length} ชุด · {plan.sets.reduce((n, s) => n + s.count, 0)} ข้อ</dd></div>
            <div className="rounded-2xl bg-muted/60 p-2.5"><dt className="text-muted-fg">งานตามปฏิทิน</dt><dd className="font-bold">{plan.tasks.length} งาน</dd></div>
          </dl>
          <ul className="space-y-1 text-sm">
            {plan.phases.map((p) => <li key={p.id}>• <b>{p.name}</b> {formatThai(p.start)} – {formatThai(p.end)}</li>)}
          </ul>
          {hasData && (
            <button className="btn-ghost w-full text-sm" onClick={async () => download(await exportBackupZip(db), `examprep-backup-${todayISO()}.zip`)}>
              สำรองข้อมูลเดิมก่อน
            </button>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setPlan(null)}>ยกเลิก</button>
            <button className="btn-cta flex-1" onClick={apply} disabled={busy}>ใช้แผนนี้</button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Upload a question bank zip, preview it, then store it on this device. */
export function BankImport({ onApplied }: { onApplied?: (n: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [read, setRead] = useState<BankRead | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function loadFile(f: File) {
    setDone(null);
    setRead(readBank(new Uint8Array(await f.arrayBuffer())));
  }

  async function apply() {
    if (!read?.bank) return;
    setProgress([0, read.summary!.figures]);
    const res = await applyBank(db, read, shrinkImage, (a, b) => setProgress([a, b]));
    setProgress(null);
    setRead(null);
    setDone(res.questions);
    onApplied?.(res.questions);
  }

  const sum = read?.summary;
  return (
    <div className="space-y-3">
      {!sum && (
        <>
          <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>
            <Library size={ICON.md} aria-hidden /> เลือกไฟล์คลังข้อสอบ (.zip)
          </button>
          <input ref={fileRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
          <p className="text-xs text-muted-fg">ไฟล์ examprep-questions.zip (โจทย์ + เฉลย + รูป) · เก็บไว้ในเครื่องนี้เท่านั้น ไม่ถูกส่งไปที่ไหน</p>
        </>
      )}
      {read && <Errors errors={read.errors} />}
      {sum && (
        <section className="card space-y-3" aria-live="polite">
          <h3 className="text-lg font-bold">คลังข้อสอบ {sum.exams} ชุด · {sum.questions} ข้อ</h3>
          <p className="text-sm">
            {Object.entries(sum.bySubject).map(([k, n]) => `${SUBJECT_TH[k] ?? k} ${n}`).join(' · ')}
          </p>
          <ul className="space-y-0.5 text-sm text-muted-fg">
            <li>มีเฉลย {sum.withAnswer}/{sum.questions} ข้อ · รูป {sum.figures} · บทอ่าน {sum.passages}</li>
            {sum.needsReview > 0 && <li className="text-warning">{sum.needsReview} ข้อควรตรวจกับหนังสือ (จะมีป้ายเตือนในข้อนั้น)</li>}
          </ul>
          {progress ? (
            <p className="text-sm font-semibold" role="status">กำลังย่อรูป {progress[0]}/{progress[1]}…</p>
          ) : (
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setRead(null)}>ยกเลิก</button>
              <button className="btn-cta flex-1" onClick={apply}>นำเข้า</button>
            </div>
          )}
        </section>
      )}
      {done !== null && <p className="text-sm font-semibold text-success" role="status">นำเข้า {done} ข้อแล้ว ✓</p>}
    </div>
  );
}
