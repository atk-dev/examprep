import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const active = data.mockSets.find((m) => m.status === 'active');
  if (active) return active.stoppedAt || remainingSec(active, Date.now()) === 0 ? <Grade data={data} set={active} /> : <Running data={data} set={active} />;
  return <Builder data={data} />;
}

function Builder({ data }: { data: AppData }) {
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
      <h1 className="text-xl font-bold">⏱️ ฝึกจับเวลา</h1>
      <p className="text-sm text-slate-500">
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
                  className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
                >
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: sub.color }} />
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
              <button key={n} onClick={() => setSize(n)} className={`btn py-1.5 ${size === n ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">เวลาต่อข้อ</div>
          <div className="grid grid-cols-3 gap-2">
            {PACES.map((p) => (
              <button key={p} onClick={() => setPace(p)} className={`btn py-1.5 ${pace === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{p} นาที</button>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full py-3" disabled={!picked.length} onClick={start}>
          เริ่ม {size} ข้อ · {formatClock(Math.round(size * pace * 60))} นาที
        </button>
      </section>

      {done.length > 0 && (
        <>
          <section className="card">
            <h2 className="font-bold">คะแนนแต่ละชุด</h2>
            <p className="mb-2 text-xs text-slate-500">% ถูก · ชุดล่าสุดอยู่ขวาสุด</p>
            <ScoreTrend
              points={done.slice(-15).map((m) => {
                const sc = scoreSet(m.items, m.results ?? []);
                return { label: formatThai(m.date), value: sc.total ? sc.correct / sc.total : 0, sub: `${sc.correct}/${sc.total} ข้อ` };
              })}
            />
          </section>
          <section className="card">
            <h2 className="mb-2 font-bold">ประวัติ</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {[...done].reverse().slice(0, 10).map((m) => {
                const sc = scoreSet(m.items, m.results ?? []);
                return (
                  <li key={m.id} className="py-2">
                    <div className="flex justify-between">
                      <span>{formatThai(m.date)}</span>
                      <b>{sc.correct}/{sc.total} ({pct(sc.total ? sc.correct / sc.total : null)})</b>
                    </div>
                    <div className="text-xs text-slate-500">
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
      <span className="mr-2 inline-block w-6 text-right text-xs text-slate-400">{i + 1}.</span>
      <span className="text-slate-500">{topic?.name ?? 'หัวข้อที่ถูกลบ'}</span> <b>ข้อ {it.problemNo}</b>
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
      <div className={`sticky top-0 z-10 -mx-4 px-4 py-3 text-center shadow-sm ${warn ? 'bg-rose-600' : 'bg-indigo-600'} text-white`}>
        <div className="text-xs opacity-80">เหลือเวลา</div>
        <div className="font-mono text-4xl font-bold tabular-nums" role="timer" aria-live="off">{formatClock(left)}</div>
        <div className="text-xs opacity-80">{set.items.length} ข้อ · ทำในกระดาษ ไม่ดูเฉลย</div>
      </div>
      {grouped(data, set).map((g) => (
        <section key={g.idx[0]} className="card">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
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
      <div className="sticky bottom-20 z-10">
        <button className="btn-primary w-full py-3 shadow-lg" onClick={() => stopMock(db, set.id!)}>ทำเสร็จแล้ว · ไปตรวจ</button>
      </div>
      <button
        className="w-full text-sm text-rose-600 underline"
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
        <div className="text-sm text-slate-500">{timeUp ? '⏰ หมดเวลา!' : 'หยุดเวลาแล้ว'}</div>
        <div className="text-lg">ใช้เวลา <b>{formatClock(used)}</b> / {formatClock(set.limitSec)}</div>
        <div className="mt-1 text-sm text-slate-500">เปิดเฉลยในหนังสือ แล้วตรวจทีละข้อ</div>
      </div>
      {grouped(data, set).map((g) => (
        <section key={g.idx[0]} className="card">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
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
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        grades[i] === k
                          ? k === 'correct' ? 'bg-emerald-500 text-white' : k === 'wrong' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {k === 'correct' ? '✓' : k === 'wrong' ? '✗' : 'ไม่ทัน'}
                    </button>
                  ))}
                </div>
                {grades[i] === 'wrong' && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-8">
                    {(['concept', 'careless', 'misread'] as MistakeReason[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReasons(reasons.map((x, j) => (j === i ? r : x)))}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${reasons[i] === r ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}
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
      <div className="sticky bottom-20 z-10 space-y-2">
        {ungraded > 0 && (
          <button className="btn-ghost w-full bg-white shadow" onClick={() => setGrades(grades.map((g) => g ?? 'correct'))}>
            ที่เหลือ {ungraded} ข้อ ถูกหมด
          </button>
        )}
        <button className="btn-primary w-full py-3 shadow-lg" disabled={ungraded > 0} onClick={save}>
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
      <h2 className="font-bold">ผลชุดล่าสุด · {formatThai(last.date)}</h2>
      <div className="my-2 text-3xl font-bold">{sc.correct}/{sc.total} <span className="text-base font-normal text-slate-500">({pct(sc.total ? sc.correct / sc.total : null)})</span></div>
      <BarList
        max={1}
        format={(v) => pct(v)}
        rows={sc.bySubject.map((b) => ({ key: String(b.subjectId), label: name.get(b.subjectId)?.name ?? '?', sub: `${b.correct}/${b.total}`, value: b.correct / b.total, color: name.get(b.subjectId)?.color ?? '#94a3b8' }))}
      />
      <Link to="/review" className="mt-3 block text-sm text-indigo-600 underline">ข้อที่ผิดเข้าสมุดข้อผิดแล้ว · ไปทวน</Link>
    </section>
  );
}
