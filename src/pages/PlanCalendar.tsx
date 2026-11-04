import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppData } from '../hooks/useAppData';
import { addDaysISO, formatThai, todayISO } from '../logic/dates';
import type { PlanTask } from '../plan/planSchema';
import { taskStatus } from '../plan/progress';
import TaskCard from '../components/TaskCard';
import { ICON } from '../components/ui';

const SHORT: Record<string, string> = { math: 'คณิต', thai: 'ไทย', science: 'วิทย์', english: 'อังกฤษ', social: 'สังคม' };
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WEEK = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

function cellLabel(t: PlanTask) {
  if (t.type === 'exam') return '★ สอบ';
  if (t.type === 'mock') return 'สอบจำลอง';
  if (t.type === 'saturday') return 'ทวน+ถาม';
  if (t.type === 'kickoff') return 'เริ่ม';
  if (t.type === 'catchup') return 'เก็บตก';
  const s = t.subject ? SHORT[t.subject] ?? t.subject : '';
  return s;
}
function cellSub(t: PlanTask) {
  if (t.type === 'practice') return t.set ? `บท ${Number(t.set.split('-').pop())}` : '';
  if (t.type === 'timed') return 'Pretest';
  if (t.type === 'reviewWrong') return 'ไล่ผิด';
  if (t.type === 'subjectReview') return 'ทวน';
  return '';
}

/** Month grid of the plan, like the teacher's paper calendar. Tap a day for its tasks. */
export default function PlanCalendar({ data }: { data: AppData }) {
  const today = todayISO();
  const first = data.tasks[0]?.date ?? today;
  const last = data.tasks[data.tasks.length - 1]?.date ?? today;
  const months: string[] = [];
  for (let m = first.slice(0, 7); m <= last.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split('-').map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }
  const startMonth = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : today < first ? months[0] : months[months.length - 1];
  const [month, setMonth] = useState(startMonth);
  const [sel, setSel] = useState<string>(today >= first && today <= last ? today : first);
  const byDate = new Map<string, PlanTask[]>();
  for (const t of data.tasks) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  const [y, mo] = month.split('-').map(Number);
  const day1 = `${month}-01`;
  const lead = (new Date(`${day1}T00:00:00`).getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(y, mo, 0).getDate();
  const cells = Array.from({ length: lead + daysIn }, (_, i) => (i < lead ? null : addDaysISO(day1, i - lead)));
  const mi = months.indexOf(month);

  return (
    <>
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button className="btn-ghost h-11 w-11 p-0" disabled={mi <= 0} onClick={() => setMonth(months[mi - 1])} aria-label="เดือนก่อน"><ChevronLeft size={ICON.md} aria-hidden /></button>
          <h2 className="text-lg font-bold" aria-live="polite">{MONTHS[mo - 1]} {y + 543}</h2>
          <button className="btn-ghost h-11 w-11 p-0" disabled={mi >= months.length - 1} onClick={() => setMonth(months[mi + 1])} aria-label="เดือนถัดไป"><ChevronRight size={ICON.md} aria-hidden /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-fg" aria-hidden>
          {WEEK.map((w, i) => <span key={w} className={i >= 5 ? 'text-danger' : ''}>{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`x${i}`} />;
            const ts = byDate.get(d) ?? [];
            const main = ts[0];
            const subject = main?.subject ? data.subjectByKey.get(main.subject) : undefined;
            const st = ts.map((t) => taskStatus(t, data.taskCtx));
            const checkable = ts.filter((t) => t.type !== 'exam' && t.type !== 'kickoff');
            const allDone = checkable.length > 0 && checkable.every((t) => taskStatus(t, data.taskCtx).done);
            const late = d < today && checkable.length > 0 && !allDone;
            const status = allDone ? 'เสร็จแล้ว' : late ? 'ค้าง' : '';
            const isExam = main?.type === 'exam';
            return (
              <button
                key={d}
                onClick={() => setSel(d)}
                aria-pressed={sel === d}
                aria-label={`${formatThai(d)}${ts.length ? `: ${ts.map((t) => t.title).join(', ')}` : ': ไม่มีงาน'}${status ? ` (${status})` : ''}`}
                className={`relative flex min-h-16 flex-col items-start overflow-hidden rounded-xl p-1 text-left text-xs leading-tight transition-colors duration-100 ${
                  isExam ? 'bg-accent text-black' : ts.length ? 'bg-card' : 'bg-muted/60 text-muted-fg'
                } ${sel === d ? 'ring-2 ring-fg' : d === today ? 'ring-2 ring-primary' : late ? 'ring-2 ring-danger/60' : 'ring-1 ring-border'}`}
              >
                {subject && <span className="absolute inset-x-0 top-0 h-1" style={{ background: subject.color }} aria-hidden />}
                <span className="mt-0.5 font-bold">{Number(d.slice(8))}</span>
                {main && <span className="w-full truncate font-semibold">{cellLabel(main)}</span>}
                {main && cellSub(main) && <span className="w-full truncate text-muted-fg">{cellSub(main)}</span>}
                {allDone && <span className="absolute right-1 bottom-0.5 font-bold text-success" aria-hidden>✓</span>}
                {late && <span className="absolute right-1 bottom-0.5 font-bold text-danger" aria-hidden>!</span>}
                {st.length > 1 && <span className="sr-only">{st.length} งาน</span>}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-fg">
          <li><span className="font-bold text-success">✓</span> เสร็จแล้ว</li>
          <li><span className="font-bold text-danger">!</span> ค้าง</li>
          {data.subjects.map((s) => <li key={s.id} className="flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: s.color }} aria-hidden />{s.name}</li>)}
        </ul>
      </section>
      <h2 className="text-lg font-bold">{formatThai(sel)}</h2>
      {(byDate.get(sel) ?? []).length ? (
        (byDate.get(sel) ?? []).map((t) => <TaskCard key={t.id} t={t} data={data} />)
      ) : (
        <p className="card text-sm text-muted-fg">ไม่มีงาน · วันพัก</p>
      )}
    </>
  );
}
