import { BarList, CalendarHeatmap, PlanChart } from '../components/charts';
import { pct } from '../components/ui';
import { addDaysISO, todayISO } from '../logic/dates';
import { dailyCounts, planGap, planVsActual, weakTopics } from '../logic/insights';
import { MISTAKE_LABELS, mistakeBreakdown, streak } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason } from '../types';

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function Stats({ data }: { data: AppData }) {
  const s = data.settings!;
  const today = todayISO();
  const counts = dailyCounts(data.attempts);
  const firstCorrect = data.states.filter((x) => x.firstResult === 'correct').length;
  const minutes = data.dailyLogs.reduce((n, l) => n + l.minutes, 0);
  const gap = planGap(s, today, data.states, data.total);
  const mistakes = mistakeBreakdown(data.attempts);
  const weak = weakTopics(data.progress);
  const firstDay = data.attempts.reduce((m, a) => (a.date < m ? a.date : m), s.startDate);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="ทำแล้ว" value={`${data.done}`} sub={`จาก ${data.total} ข้อ`} />
        <Tile label="ถูกครั้งแรก" value={pct(data.done ? firstCorrect / data.done : null)} sub="ไม่นับการทวน" />
        <Tile label="เทียบแผน" value={gap >= 0 ? `+${gap}` : `${gap}`} sub={gap >= 0 ? 'ข้อ นำแผน' : 'ข้อ ช้ากว่าแผน'} />
        <Tile label="ต่อเนื่อง" value={`${streak(data.attempts, today)} วัน`} sub={`เรียนรวม ${Math.round(minutes / 60)} ชม.`} />
      </div>

      <section className="card">
        <h2 className="font-bold">ความคืบหน้าเทียบแผน</h2>
        <p className="mb-2 text-xs text-slate-500">จำนวนข้อสะสม (รอบแรก)</p>
        <PlanChart points={planVsActual(s, data.states, data.total, today)} today={today} />
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">ปฏิทินการเรียน (ถึงวันสอบ)</h2>
        <CalendarHeatmap counts={counts} from={firstDay} to={addDaysISO(s.examDate, -1)} today={today} />
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">ถูกครั้งแรกรายวิชา</h2>
        <BarList
          max={1}
          format={(v) => pct(v)}
          rows={data.progress
            .filter((p) => p.total > 0)
            .map((p) => ({ key: String(p.subject.id), label: p.subject.name, sub: `${p.done} ข้อ`, value: p.accuracy, color: p.subject.color }))}
        />
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">สาเหตุที่ทำผิด</h2>
        {Object.values(mistakes).some((n) => n > 0) ? (
          <BarList
            format={(v) => `${v} ข้อ`}
            rows={(Object.keys(MISTAKE_LABELS) as MistakeReason[]).map((r) => ({ key: r, label: MISTAKE_LABELS[r], value: mistakes[r], color: '#e11d48' }))}
          />
        ) : (
          <p className="text-sm text-slate-400">ยังไม่มีข้อผิดที่ระบุสาเหตุ</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">หัวข้อที่ควรเสริม</h2>
        {weak.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {weak.map((w) => (
              <li key={w.t.topic.id} className="flex justify-between py-2">
                <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: w.subject.color }} />{w.subject.name} · {w.t.topic.name}</span>
                <b>{pct(w.t.accuracy)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">ยังไม่มี (ต้องทำอย่างน้อย 5 ข้อต่อหัวข้อ และถูกต่ำกว่า 80%)</p>
        )}
      </section>
    </>
  );
}
