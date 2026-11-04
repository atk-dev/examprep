import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { AppData } from '../hooks/useAppData';
import { formatThai, todayISO } from '../logic/dates';
import { isScored, mockTotal, taskStatus } from '../plan/progress';
import { taskLink } from '../components/TaskCard';
import { ScoreTrend } from '../components/charts';
import { CardTitle, ICON, pct } from '../components/ui';
import { Tile } from './Stats';

/** Weakest question topics (first-try accuracy), from the bank's `topic` tags. */
function weakQuestionTopics(data: AppData, min = 3) {
  const agg = new Map<string, { subjectId: number; topic: string; n: number; ok: number }>();
  for (const [topicId, qs] of data.questionsByTopic) {
    const states = data.statesByTopic.get(topicId);
    const t = data.topics.find((x) => x.id === topicId);
    if (!states || !t) continue;
    for (const [no, q] of qs) {
      const s = states.get(no);
      if (!s || !q.topic) continue;
      const key = `${t.subjectId}|${q.topic}`;
      const a = agg.get(key) ?? { subjectId: t.subjectId, topic: q.topic, n: 0, ok: 0 };
      a.n++;
      if (s.firstResult === 'correct') a.ok++;
      agg.set(key, a);
    }
  }
  return [...agg.values()].filter((a) => a.n >= min && a.ok / a.n < 0.8).sort((a, b) => a.ok / a.n - b.ok / b.n).slice(0, 10);
}

export default function Scores({ data }: { data: AppData }) {
  const plan = data.plan!;
  const today = todayISO();
  const [subject, setSubject] = useState<string | null>(null);
  const scored = data.tasks.filter(isScored);
  const rows = scored.filter((t) => !subject || t.subject === subject);
  const statuses = scored.map((t) => taskStatus(t, data.taskCtx));
  const doneCount = statuses.filter((s) => s.done).length;
  const answered = statuses.reduce((n, s) => n + (s.answered ?? 0), 0);
  const correct = statuses.reduce((n, s) => n + (s.correct ?? 0), 0);
  const total = plan.exam.totalScore ?? 200;
  const target = data.settings?.profile?.targetScore ?? null;
  const mocks = plan.mocks.map((m) => ({ ...m, rec: data.mockExams.find((x) => x.n === m.n) }));
  const trend = mocks.filter((m) => mockTotal(m.rec)).map((m) => ({ label: `ครั้งที่ ${m.n}`, value: mockTotal(m.rec)! / total, sub: `${mockTotal(m.rec)}/${total}` }));
  const weak = weakQuestionTopics(data);
  const subjName = (key: string) => data.subjectByKey.get(key)?.name ?? key;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="งานที่ทำแล้ว" value={`${doneCount}/${scored.length}`} sub="โจทย์ท้ายบท + Pretest" />
        <Tile label="ถูกครั้งแรก" value={pct(answered ? correct / answered : null)} sub={`${correct}/${answered} ข้อ`} />
      </div>

      <section className="card space-y-3">
        <CardTitle>สอบจำลอง</CardTitle>
        {trend.length > 0 ? (
          <ScoreTrend points={trend} />
        ) : (
          <p className="text-sm text-muted-fg">ยังไม่มีคะแนน · ครั้งแรก {formatThai(plan.mocks[0].date)}</p>
        )}
        {target ? <p className="text-sm">เป้าหมาย <b>{target}/{total}</b> ({pct(target / total)})</p> : null}
        <ul className="divide-y divide-muted">
          {mocks.map((m) => {
            const sum = mockTotal(m.rec);
            return (
              <li key={m.n} className="flex min-h-12 items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>ครั้งที่ {m.n}</b> · {formatThai(m.date)}
                  {m.rec?.focus ? <span className="block text-xs text-muted-fg">เน้น: {subjName(m.rec.focus)}</span> : null}
                </span>
                <span className="text-right">
                  {sum ? <b className="font-display text-lg">{sum}/{total}</b> : <span className="text-muted-fg">{m.date <= today ? 'ยังไม่บันทึก' : '–'}</span>}
                  {sum && target ? <span className={`block text-xs ${sum >= target ? 'text-success' : 'text-warning'}`}>{sum >= target ? 'ถึงเป้า' : `ขาด ${target - sum}`}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <Link to="/mock?tab=exam" className="btn-ghost w-full">บันทึกคะแนนสอบจำลอง</Link>
      </section>

      {weak.length > 0 && (
        <section className="card space-y-2">
          <CardTitle>เรื่องที่ยังอ่อน</CardTitle>
          <p className="text-xs text-muted-fg">จากโจทย์ในแอปที่ทำอย่างน้อย 3 ข้อ · ถูกครั้งแรกต่ำกว่า 80%</p>
          <ul className="divide-y divide-muted text-sm">
            {weak.map((w) => {
              const s = data.subjects.find((x) => x.id === w.subjectId);
              return (
                <li key={`${w.subjectId}${w.topic}`} className="flex min-h-11 items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s?.color }} aria-hidden />{s?.name} · {w.topic}</span>
                  <b>{w.ok}/{w.n}</b>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <CardTitle>บันทึกคะแนน โจทย์ท้ายบท และ Pretest</CardTitle>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="กรองตามวิชา">
          <button className="chip" aria-pressed={!subject} onClick={() => setSubject(null)}>ทุกวิชา</button>
          {data.subjects.map((s) => (
            <button key={s.id} className="chip" aria-pressed={subject === s.key} onClick={() => setSubject(s.key ?? null)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />{s.name}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-muted">
          {rows.map((t) => {
            const st = taskStatus(t, data.taskCtx);
            const link = taskLink(t, data);
            const s = t.subject ? data.subjectByKey.get(t.subject) : undefined;
            return (
              <li key={t.id}>
                <Link to={link ?? '/progress?tab=plan'} className="flex min-h-14 items-center gap-3 py-2">
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: s?.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-fg">{formatThai(t.date)} · {s?.name}</span>
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {st.answered ? <b>{st.correct}/{st.size}</b> : <span className="text-muted-fg">{st.size ? `–/${st.size}` : ''}</span>}
                    {st.done && <Check size={ICON.sm} strokeWidth={3} className="ml-1 inline text-success" aria-label="เสร็จแล้ว" />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
