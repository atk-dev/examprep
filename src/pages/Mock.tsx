import { AlarmClock, Timer } from 'lucide-react';
import { CardTitle, ICON, PageTitle, Segmented } from '../components/ui';
import { mockTotal } from '../plan/progress';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { finishMock, startMock, stopMock } from '../db/actions';
import { BarList, ScoreTrend } from '../components/charts';
import { pct } from '../components/ui';
import { formatThai, todayISO } from '../logic/dates';
import { formatClock, generateSet, remainingSec, scoreSet, usedSec } from '../logic/mock';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason, MockResult, MockSet } from '../types';

const SIZES = [10, 20, 30, 50];
const PACES = [1, 1.5, 2];

export default function Mock({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const active = data.mockSets.find((m) => m.status === 'active');
  if (active) return active.stoppedAt || remainingSec(active, Date.now()) === 0 ? <Grade data={data} set={active} /> : <Running data={data} set={active} />;
  if (!data.planMode) return <Builder data={data} />;
  const tab = params.get('tab') === 'practice' ? 'practice' : 'exam';
  return (
    <>
      <PageTitle icon={Timer}>สอบจำลอง</PageTitle>
      <Segmented
        label="มุมมอง"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        options={[{ id: 'exam', label: `สอบจำลอง ${data.plan!.mocks.length} ครั้ง` }, { id: 'practice', label: 'ฝึกจับเวลา' }]}
      />
      {tab === 'exam' ? <MockExams data={data} /> : <Builder data={data} hideTitle />}
    </>
  );
}

/** The plan's mock exams: guided timer in real exam order + score per subject. */
function MockExams({ data }: { data: AppData }) {
  const plan = data.plan!;
  const today = todayISO();
  const sessions = plan.exam.sessions;
  const total = plan.exam.totalScore ?? sessions.reduce((n, x) => n + x.questions, 0);
  const target = data.settings?.profile?.targetScore ?? null;
  const defaultN = (plan.mocks.find((m) => m.date >= today) ?? plan.mocks[plan.mocks.length - 1]).n;
  const [n, setN] = useState(defaultN);
  const mock = plan.mocks.find((m) => m.n === n)!;
  const rec = data.mockExams.find((m) => m.n === n);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState('');
  const [focus, setFocus] = useState('');
  const [saved, setSaved] = useState(false);
  const now = useNow();
  useEffect(() => {
    setScores(Object.fromEntries(sessions.map((x) => [x.subject, rec?.scores[x.subject] != null ? String(rec.scores[x.subject]) : ''])));
    setMinutes(rec?.minutes ? String(rec.minutes) : '');
    setFocus(rec?.focus ?? '');
    setSaved(false);
    // Reload the form only when switching rounds: saving creates/updates `rec`, and reacting to
    // that would wipe the "saved" confirmation. Data is already loaded when this page renders.
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (k: string) => data.subjectByKey.get(k)?.name ?? k;
  // 1.1: question sets this mock can run in the app, one per subject.
  const inApp = new Map<string, { topicId: number; correct: number; answered: number }>();
  for (const id of mock.sets ?? []) {
    const set = plan.sets.find((x) => x.id === id);
    const topic = data.topicByKey.get(id);
    if (!set || !topic || !data.questionsByTopic.has(topic.id!)) continue;
    const states = [...(data.statesByTopic.get(topic.id!)?.values() ?? [])];
    inApp.set(set.subject, { topicId: topic.id!, answered: states.length, correct: states.filter((x) => x.firstResult === 'correct').length });
  }
  const sum = sessions.reduce((acc, x) => acc + (Number(scores[x.subject]) || 0), 0);
  const invalid = sessions.some((x) => scores[x.subject] !== '' && scores[x.subject] !== undefined && (Number(scores[x.subject]) < 0 || Number(scores[x.subject]) > x.questions));

  async function save() {
    const parsed = Object.fromEntries(sessions.map((x) => [x.subject, scores[x.subject] === '' ? null : Math.round(Number(scores[x.subject]))]));
    await db.mockExams.put({ ...rec, n, date: mock.date, scores: parsed, minutes: minutes ? Math.round(Number(minutes)) : null, focus: focus || undefined });
    setSaved(true);
  }

  // Guided timer: subjects back to back in the real exam order.
  const startedAt = rec?.timerStartedAt;
  let timer: { subject: string; left: number; i: number } | null = null;
  if (startedAt) {
    let t = Math.floor((now - startedAt) / 1000);
    for (const [i, x] of sessions.entries()) {
      if (t < x.minutes * 60) { timer = { subject: x.subject, left: x.minutes * 60 - t, i }; break; }
      t -= x.minutes * 60;
    }
  }
  const startTimer = () => db.mockExams.put({ ...(rec ?? { n, date: mock.date, scores: {} }), timerStartedAt: Date.now() });
  const stopTimer = () => rec && db.mockExams.put({ ...rec, timerStartedAt: undefined });

  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="เลือกครั้ง">
        {plan.mocks.map((m) => {
          const t = mockTotal(data.mockExams.find((x) => x.n === m.n));
          return (
            <button key={m.n} className="chip" aria-pressed={n === m.n} onClick={() => setN(m.n)}>
              ครั้งที่ {m.n}{t ? ` · ${t}` : ''}
            </button>
          );
        })}
      </div>

      <section className="card space-y-3">
        <CardTitle>ครั้งที่ {n} · {formatThai(mock.date)}</CardTitle>
        {mock.note && <p className="text-sm text-muted-fg">{mock.note}</p>}
        <ol className="space-y-1 text-sm">
          {sessions.map((x, i) => (
            <li key={x.subject} className={`flex justify-between rounded-xl px-2 py-1 ${timer?.i === i ? 'bg-primary/10 font-bold' : ''}`}>
              <span>{x.start ?? ''} {name(x.subject)}</span><span>{x.questions} ข้อ · {x.minutes} นาที</span>
            </li>
          ))}
        </ol>
        {timer ? (
          <div className="rounded-2xl bg-primary p-3 text-center text-white" role="timer" aria-label={`${name(timer.subject)} เหลือ ${formatClock(timer.left)}`}>
            <p className="text-sm">{name(timer.subject)} · วิชาที่ {timer.i + 1}/{sessions.length}</p>
            <p className="font-display text-4xl font-bold tabular-nums">{formatClock(timer.left)}</p>
            <button className="btn-ghost mt-2" onClick={stopTimer}>หยุดจับเวลา</button>
          </div>
        ) : startedAt ? (
          <p className="text-sm font-semibold text-success">ครบทุกวิชาแล้ว · กรอกคะแนนด้านล่าง</p>
        ) : (
          <button className="btn-primary w-full" onClick={startTimer}><AlarmClock size={ICON.md} aria-hidden /> จับเวลาตามตารางสอบจริง</button>
        )}
      </section>

      {inApp.size > 0 && (
        <section className="card space-y-2">
          <CardTitle>ทำข้อสอบชุดนี้ในแอป</CardTitle>
          <ul className="space-y-2">
            {sessions.filter((x) => inApp.has(x.subject)).map((x) => {
              const a = inApp.get(x.subject)!;
              return (
                <li key={x.subject} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-semibold">{name(x.subject)} <span className="font-normal text-muted-fg">· ทำแล้ว {a.answered} ข้อ</span></span>
                  <Link to={`/log?topic=${a.topicId}&minutes=${x.minutes}`} className="btn-primary text-sm">ทำในแอป</Link>
                  {a.answered > 0 && (
                    <button className="btn-ghost text-sm" onClick={() => { setScores((cur) => ({ ...cur, [x.subject]: String(a.correct) })); setSaved(false); }}>
                      ใช้คะแนน {a.correct}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <CardTitle>คะแนน</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {sessions.map((x) => (
            <div key={x.subject}>
              <label className="label" htmlFor={`ms-${x.subject}`}>{name(x.subject)} (เต็ม {x.questions})</label>
              <input id={`ms-${x.subject}`} className="input text-center" type="number" inputMode="numeric" min={0} max={x.questions}
                value={scores[x.subject] ?? ''} onChange={(e) => { setScores({ ...scores, [x.subject]: e.target.value }); setSaved(false); }} />
            </div>
          ))}
          <div>
            <label className="label" htmlFor="ms-min">เวลาที่ใช้ (นาที)</label>
            <input id="ms-min" className="input text-center" type="number" inputMode="numeric" min={0} value={minutes} onChange={(e) => { setMinutes(e.target.value); setSaved(false); }} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ms-focus">วิชาที่ต้องเน้นสัปดาห์หน้า</label>
          <select id="ms-focus" className="input" value={focus} onChange={(e) => { setFocus(e.target.value); setSaved(false); }}>
            <option value="">— เลือก —</option>
            {sessions.map((x) => <option key={x.subject} value={x.subject}>{name(x.subject)}</option>)}
          </select>
        </div>
        <p className="text-center">รวม <b className="font-display text-3xl">{sum}</b> / {total}
          {target ? <span className={`block text-sm ${sum >= target ? 'text-success' : 'text-muted-fg'}`}>เป้าหมาย {target}{sum >= target ? ' · ถึงเป้าแล้ว!' : ` · ขาดอีก ${target - sum}`}</span> : null}
        </p>
        {invalid && <p className="text-sm font-semibold text-danger" role="alert">คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็มของวิชา</p>}
        <button className="btn-cta w-full py-3 text-base" disabled={invalid} onClick={save}>{saved ? 'บันทึกแล้ว ✓' : 'บันทึกคะแนน'}</button>
      </section>
      <Link to="/progress?tab=scores" className="btn-ghost w-full">ดูคะแนนทุกครั้ง</Link>
    </>
  );
}

function Builder({ data, hideTitle = false }: { data: AppData; hideTitle?: boolean }) {
  const s = data.settings!;
  const withTopics = data.subjects.filter((sub) => data.topics.some((t) => t.subjectId === sub.id));
  const [picked, setPicked] = useState<number[]>(withTopics.map((x) => x.id!));
  const [size, setSize] = useState(20);
  const [pace, setPace] = useState(s.mockMinutesPerProblem ?? 1.5);
  const done = data.mockSets.filter((m) => m.status === 'done');
  const subjectName = new Map(data.subjects.map((x) => [x.id!, x.name]));

  async function start() {
    const states = new Map(data.states.map((x) => [x.key, x]));
    const items = generateSet({ subjects: data.subjects, topics: data.topics, states, subjectIds: picked, size });
    if (!items.length) return;
    if ((s.mockMinutesPerProblem ?? 1.5) !== pace) await db.settings.update('main', { mockMinutesPerProblem: pace });
    await startMock(db, items, Math.round(items.length * pace * 60), todayISO());
  }

  return (
    <>
      {!hideTitle && <PageTitle icon={Timer}>ฝึกจับเวลา</PageTitle>}
      <p className="text-sm text-muted-fg">
        สุ่มโจทย์คละวิชาจากหนังสือ เน้นข้อที่เคยผิดและหัวข้อที่ยังอ่อน ทำในกระดาษแบบไม่ดูเฉลย แล้วกลับมาตรวจ
      </p>
      {done.length > 0 && done.at(-1)!.date === todayISO() && <LastResult data={data} />}

      <section className="card space-y-4">
        <div>
          <div className="label">วิชา</div>
          <div className="flex flex-wrap gap-2">
            {withTopics.map((sub) => {
              const on = picked.includes(sub.id!);
              return (
                <button
                  key={sub.id}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== sub.id) : [...picked, sub.id!])}
                  className="chip"
                  aria-pressed={on}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sub.color }} aria-hidden />
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="label">จำนวนข้อ</div>
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((n) => (
              <button key={n} onClick={() => setSize(n)} className="chip justify-center" aria-pressed={size === n}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">เวลาต่อข้อ</div>
          <div className="grid grid-cols-3 gap-2">
            {PACES.map((p) => (
              <button key={p} onClick={() => setPace(p)} className="chip justify-center" aria-pressed={pace === p}>{p} นาที</button>
            ))}
          </div>
        </div>
        <button className="btn-cta w-full py-3 text-base" disabled={!picked.length} onClick={start}>
          เริ่ม {size} ข้อ · {formatClock(Math.round(size * pace * 60))} นาที
        </button>
      </section>

      {done.length > 0 && (
        <>
          <section className="card">
            <h2 className="text-lg font-bold">คะแนนแต่ละชุด</h2>
            <p className="mb-2 text-xs text-muted-fg">% ถูก · ชุดล่าสุดอยู่ขวาสุด</p>
            <ScoreTrend
              points={done.slice(-15).map((m) => {
                const sc = scoreSet(m.items, m.results ?? []);
                return { label: formatThai(m.date), value: sc.total ? sc.correct / sc.total : 0, sub: `${sc.correct}/${sc.total} ข้อ` };
              })}
            />
          </section>
          <section className="card">
            <h2 className="mb-2 text-lg font-bold">ประวัติ</h2>
            <ul className="divide-y divide-muted text-sm">
              {[...done].reverse().slice(0, 10).map((m) => {
                const sc = scoreSet(m.items, m.results ?? []);
                return (
                  <li key={m.id} className="py-2">
                    <div className="flex justify-between">
                      <span>{formatThai(m.date)}</span>
                      <b>{sc.correct}/{sc.total} ({pct(sc.total ? sc.correct / sc.total : null)})</b>
                    </div>
                    <div className="text-xs text-muted-fg">
                      ใช้เวลา {formatClock(usedSec(m, Date.now()))} / {formatClock(m.limitSec)} ·{' '}
                      {sc.bySubject.map((b) => `${subjectName.get(b.subjectId) ?? '?'} ${b.correct}/${b.total}`).join(' · ')}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function ItemLabel({ data, i, set }: { data: AppData; i: number; set: MockSet }) {
  const it = set.items[i];
  const topic = data.topics.find((t) => t.id === it.topicId);
  return (
    <span className="min-w-0 flex-1">
      <span className="mr-2 inline-block w-6 text-right text-xs text-muted-fg">{i + 1}.</span>
      <span className="text-muted-fg">{topic?.name ?? 'หัวข้อที่ถูกลบ'}</span> <b>ข้อ {it.problemNo}</b>
    </span>
  );
}

function grouped(data: AppData, set: MockSet) {
  const out: { subjectId: number; idx: number[] }[] = [];
  set.items.forEach((it, i) => {
    const g = out.at(-1);
    if (g && g.subjectId === it.subjectId) g.idx.push(i);
    else out.push({ subjectId: it.subjectId, idx: [i] });
  });
  return out.map((g) => ({ ...g, subject: data.subjects.find((x) => x.id === g.subjectId) }));
}

function Running({ data, set }: { data: AppData; set: MockSet }) {
  const now = useNow();
  const left = remainingSec(set, now);
  useEffect(() => {
    if (left === 0) {
      navigator.vibrate?.([300, 100, 300]);
      stopMock(db, set.id!);
    }
  }, [left, set.id]);
  const warn = left <= 60;

  return (
    <>
      <div className={`sticky top-[env(safe-area-inset-top)] z-10 rounded-[1.75rem] px-4 py-3 text-center text-white transition-colors duration-300 ${warn ? 'bg-danger shadow-[0_5px_0_0_#7f1d1d]' : 'bg-primary shadow-[0_5px_0_0_var(--color-primary-strong)]'}`}>
        <div className="text-sm text-white/90">{warn ? 'ใกล้หมดเวลา!' : 'เหลือเวลา'}</div>
        <div className="font-display text-5xl font-bold tabular-nums" role="timer" aria-live="off" aria-label={`เหลือเวลา ${formatClock(left)}`}>{formatClock(left)}</div>
        <div className="text-sm text-white/90">{set.items.length} ข้อ · ทำในกระดาษ ไม่ดูเฉลย</div>
      </div>
      {grouped(data, set).map((g) => (
        <section key={g.idx[0]} className="card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <span className="h-3 w-3 rounded-full" style={{ background: g.subject?.color }} />
            {g.subject?.name}
          </h2>
          <ul className="space-y-1.5 text-sm">
            {g.idx.map((i) => (
              <li key={i} className="flex"><ItemLabel data={data} i={i} set={set} /></li>
            ))}
          </ul>
        </section>
      ))}
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10">
        <button className="btn-cta w-full py-3 text-base" onClick={() => stopMock(db, set.id!)}>ทำเสร็จแล้ว · ไปตรวจ</button>
      </div>
      <button
        className="min-h-11 w-full text-sm font-semibold text-danger underline"
        onClick={() => confirm('ยกเลิกชุดนี้? จะไม่บันทึกผล') && db.mockSets.delete(set.id!)}
      >
        ยกเลิกชุดนี้
      </button>
    </>
  );
}

type Grade = 'correct' | 'wrong' | 'time';

function Grade({ data, set }: { data: AppData; set: MockSet }) {
  const [grades, setGrades] = useState<(Grade | null)[]>(() => set.items.map(() => null));
  const [reasons, setReasons] = useState<(MistakeReason | undefined)[]>(() => set.items.map(() => undefined));
  const used = usedSec(set, Date.now());
  const timeUp = used >= set.limitSec;
  const ungraded = grades.filter((g) => g === null).length;

  const setG = (i: number, g: Grade) => setGrades(grades.map((x, j) => (j === i ? (x === g ? null : g) : x)));
  const results: MockResult[] = grades.map((g, i) =>
    g === 'correct' ? { result: 'correct' } : g === 'time' ? { result: 'wrong', reason: 'time' } : { result: 'wrong', reason: reasons[i] },
  );
  const score = scoreSet(set.items, results);

  async function save() {
    await finishMock(db, set.id!, results, todayISO());
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div className="card text-center">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-fg">
          <AlarmClock size={ICON.sm} aria-hidden /> {timeUp ? 'หมดเวลา!' : 'หยุดเวลาแล้ว'}
        </div>
        <div className="text-lg">ใช้เวลา <b>{formatClock(used)}</b> / {formatClock(set.limitSec)}</div>
        <div className="mt-1 text-sm text-muted-fg">เปิดเฉลยในหนังสือ แล้วตรวจทีละข้อ</div>
      </div>
      {grouped(data, set).map((g) => (
        <section key={g.idx[0]} className="card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <span className="h-3 w-3 rounded-full" style={{ background: g.subject?.color }} />
            {g.subject?.name}
          </h2>
          <ul className="space-y-2 text-sm">
            {g.idx.map((i) => (
              <li key={i}>
                <div className="flex items-center gap-1.5">
                  <ItemLabel data={data} i={i} set={set} />
                  {(['correct', 'wrong', 'time'] as Grade[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setG(i, k)}
                      aria-label={`ข้อที่ ${i + 1} ${k === 'correct' ? 'ถูก' : k === 'wrong' ? 'ผิด' : 'ไม่ทัน'}`}
                      aria-pressed={grades[i] === k}
                      className={`grid h-11 min-w-11 place-items-center rounded-xl px-2 text-sm font-bold transition-colors duration-100 ${
                        grades[i] === k
                          ? k === 'correct' ? 'bg-success text-white' : k === 'wrong' ? 'bg-danger text-white' : 'bg-warning text-white'
                          : 'bg-muted text-muted-fg shadow-[0_2px_0_0_var(--color-border)]'
                      }`}
                    >
                      {k === 'correct' ? '✓' : k === 'wrong' ? '✗' : 'ไม่ทัน'}
                    </button>
                  ))}
                </div>
                {grades[i] === 'wrong' && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-8" role="group" aria-label={`ข้อที่ ${i + 1} ผิดเพราะ`}>
                    {(['concept', 'careless', 'misread'] as MistakeReason[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReasons(reasons.map((x, j) => (j === i ? r : x)))}
                        className="chip"
                        aria-pressed={reasons[i] === r}
                      >
                        {MISTAKE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 space-y-2">
        {ungraded > 0 && (
          <button className="btn-ghost w-full bg-card" onClick={() => setGrades(grades.map((g) => g ?? 'correct'))}>
            ที่เหลือ {ungraded} ข้อ ถูกหมด
          </button>
        )}
        <button className="btn-cta w-full py-3 text-base" disabled={ungraded > 0} onClick={save}>
          {ungraded > 0 ? `ตรวจอีก ${ungraded} ข้อ` : `บันทึกผล ${score.correct}/${score.total}`}
        </button>
      </div>
    </>
  );
}

/** Shown on the builder right after a set is graded. */
export function LastResult({ data }: { data: AppData }) {
  const last = data.mockSets.filter((m) => m.status === 'done').at(-1);
  if (!last) return null;
  const sc = scoreSet(last.items, last.results ?? []);
  const name = new Map(data.subjects.map((x) => [x.id!, x]));
  return (
    <section className="card">
      <h2 className="text-lg font-bold">ผลชุดล่าสุด · {formatThai(last.date)}</h2>
      <div className="my-2 font-display text-4xl font-bold">{sc.correct}/{sc.total} <span className="text-base font-normal text-muted-fg">({pct(sc.total ? sc.correct / sc.total : null)})</span></div>
      <BarList
        max={1}
        format={(v) => pct(v)}
        rows={sc.bySubject.map((b) => ({ key: String(b.subjectId), label: name.get(b.subjectId)?.name ?? '?', sub: `${b.correct}/${b.total}`, value: b.correct / b.total, color: name.get(b.subjectId)?.color ?? '#94a3b8' }))}
      />
      <Link to="/review" className="mt-3 flex min-h-11 items-center text-sm font-semibold text-primary underline">ข้อที่ผิดเข้าสมุดข้อผิดแล้ว · ไปทวน</Link>
    </section>
  );
}
