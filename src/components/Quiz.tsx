import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleHelp, Lightbulb, RotateCcw, Timer, TriangleAlert, X } from 'lucide-react';
import { db } from '../db/db';
import { saveMarks, setAskTeacher } from '../db/actions';
import { todayISO } from '../logic/dates';
import { formatClock } from '../logic/mock';
import { MISTAKE_LABELS } from '../logic/stats';
import type { MistakeReason, Passage, ProblemNote, ProblemState, Question, Subject, Topic } from '../types';
import FigureImage from './FigureImage';
import { CardTitle, ICON, ProgressBar } from './ui';

interface Props {
  topic: Topic;
  subject?: Subject;
  /** Problem numbers to ask, in order. */
  nos: number[];
  questions: Map<number, Question>;
  passages: Map<string, Passage>;
  states: Map<number, ProblemState>;
  notes: Map<string, ProblemNote>;
  minutes?: number | null;
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function isCorrect(q: Question, picked: number | null, typed: string, self: boolean | null) {
  if (q.type === 'choice') return picked !== null && picked === q.answer;
  if (q.type === 'short' && q.answer !== null && q.answer !== '') return norm(typed) === norm(String(q.answer));
  return self === true;
}

/** In-app practice: one question at a time, answers saved like logged problems. */
export default function Quiz({ topic, subject, nos: nosProp, questions, passages, states, notes, minutes }: Props) {
  // Freeze the list at start: answering a question changes what the parent would pass next.
  const [nos] = useState(nosProp);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [self, setSelf] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState<MistakeReason | undefined>();
  const [results, setResults] = useState<{ no: number; correct: boolean }[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!minutes) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [minutes]);

  const no = nos[idx];
  const q = no !== undefined ? questions.get(no) : undefined;
  const passage = q?.passageId ? passages.get(q.passageId) : undefined;
  const correct = q ? isCorrect(q, picked, typed, self) : false;
  const finished = idx >= nos.length;
  const left = minutes ? minutes * 60 - Math.floor((now - startedAt) / 1000) : null;
  const askKey = `${topic.id}:${no}`;
  const asked = !!notes.get(askKey)?.askTeacher;
  const seenBefore = no !== undefined && states.has(no);

  const canCheck = q && (q.type === 'choice' ? picked !== null : q.type === 'short' ? typed.trim() !== '' : self !== null);

  async function next() {
    if (!q) return;
    await saveMarks(db, [{ topicId: topic.id!, problemNo: no, result: correct ? 'correct' : 'wrong', reason: correct ? undefined : reason }], todayISO(), seenBefore);
    setResults((r) => [...r, { no, correct }]);
    setIdx((i) => i + 1);
    setPicked(null);
    setTyped('');
    setSelf(null);
    setChecked(false);
    setReason(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const score = useMemo(() => results.filter((r) => r.correct).length, [results]);

  if (finished) {
    const wrong = results.filter((r) => !r.correct);
    return (
      <section className="card space-y-3 text-center" aria-live="polite">
        <CardTitle className="justify-center">ทำเสร็จแล้ว!</CardTitle>
        <p className="font-display text-5xl font-bold">
          {score}<span className="text-2xl text-muted-fg">/{results.length}</span>
        </p>
        {minutes && <p className="text-sm text-muted-fg">ใช้เวลา {formatClock(Math.floor((now - startedAt) / 1000))}</p>}
        {wrong.length > 0 ? (
          <p className="text-sm">ข้อที่ผิด: <b>{wrong.map((w) => w.no).join(', ')}</b> · จะกลับมาให้ทวนพรุ่งนี้</p>
        ) : (
          <p className="text-sm font-semibold text-success">ถูกทุกข้อ เก่งมาก! 🎉</p>
        )}
        <div className="flex gap-2">
          <Link to="/" className="btn-cta flex-1">กลับหน้าวันนี้</Link>
          {wrong.length > 0 && <Link to="/review?tab=notebook" className="btn-ghost flex-1">ดูข้อผิด</Link>}
        </div>
      </section>
    );
  }
  if (!q) return null;

  // Match the book: solutions say "ตอบข้อ 2" and picture choices are numbered 1–4; English uses a–d.
  const label = (i: number) => (subject?.key === 'english' ? 'abcd'[i] ?? String(i + 1) : String(i + 1));

  return (
    <div className="space-y-3">
      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold">ข้อ {q.no} <span className="font-normal text-muted-fg">({idx + 1} จาก {nos.length})</span></span>
          {left !== null && (
            <span role="timer" aria-label={`เหลือเวลา ${formatClock(Math.max(left, 0))}`}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold tabular-nums ${left <= 60 ? 'bg-danger text-white' : 'bg-primary/10 text-primary'}`}>
              <Timer size={ICON.sm} aria-hidden /> {left > 0 ? formatClock(left) : 'หมดเวลา'}
            </span>
          )}
        </div>
        <ProgressBar value={idx / nos.length} />
      </div>

      <article className="card space-y-3" aria-labelledby="q-text">
        {q.needsReview && (
          <p className="flex items-start gap-2 rounded-2xl bg-warning-bg p-2.5 text-sm text-warning">
            <TriangleAlert size={ICON.sm} className="mt-0.5 shrink-0" aria-hidden />
            <span><b>ตรวจกับหนังสือ:</b> {q.reviewNote || 'ข้อนี้อาจถอดความไม่ครบ'}</span>
          </p>
        )}
        {passage && (
          <details open className="rounded-2xl bg-muted/60 p-3">
            <summary className="min-h-11 font-semibold">ข้อมูลประกอบ / บทอ่าน</summary>
            {passage.text && <p className="mt-2 text-sm whitespace-pre-wrap">{passage.text}</p>}
            {passage.image && <div className="mt-2"><FigureImage id={passage.image} alt="รูปประกอบบทอ่าน" /></div>}
          </details>
        )}
        <p id="q-text" className="text-lg leading-relaxed whitespace-pre-wrap">{q.text}</p>
        {q.image && <FigureImage id={q.image} alt={`รูปประกอบข้อ ${q.no}`} />}

        {q.type === 'choice' && (
          <div className="space-y-2" role="group" aria-label="ตัวเลือก">
            {(q.choices ?? []).map((c, i) => {
              const n = i + 1;
              const isAns = checked && n === q.answer;
              const isWrongPick = checked && n === picked && n !== q.answer;
              return (
                <button
                  key={i}
                  disabled={checked}
                  aria-pressed={picked === n}
                  onClick={() => setPicked(n)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 p-3 text-left text-base transition-colors duration-100 disabled:cursor-default ${
                    isAns ? 'border-success bg-success-bg text-success'
                      : isWrongPick ? 'border-danger bg-danger-bg text-danger'
                        : picked === n ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${picked === n || isAns ? 'bg-fg text-white' : 'bg-muted'}`} aria-hidden>
                    {isAns ? <Check size={ICON.sm} strokeWidth={3} /> : isWrongPick ? <X size={ICON.sm} strokeWidth={3} /> : label(i)}
                  </span>
                  <span className="whitespace-pre-wrap">{c}</span>
                  <span className="sr-only">{isAns ? ' (คำตอบที่ถูก)' : isWrongPick ? ' (ที่เลือก ผิด)' : ''}</span>
                </button>
              );
            })}
          </div>
        )}
        {q.type === 'short' && (
          <div>
            <label className="label" htmlFor="short-ans">คำตอบ</label>
            <input id="short-ans" className="input" value={typed} disabled={checked} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        {q.type === 'open' && !checked && (
          <p className="text-sm text-muted-fg">เขียนคำตอบในกระดาษ แล้วเทียบกับเฉลย</p>
        )}

        {!checked ? (
          q.type === 'open' ? (
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => { setSelf(true); setChecked(true); }}>ดูเฉลย · ฉันตอบถูก</button>
              <button className="btn-ghost flex-1" onClick={() => { setSelf(false); setChecked(true); }}>ดูเฉลย · ฉันตอบผิด</button>
            </div>
          ) : (
            <button className="btn-cta w-full py-3 text-base" disabled={!canCheck} onClick={() => setChecked(true)}>ตรวจคำตอบ</button>
          )
        ) : (
          <div className="space-y-3" aria-live="polite">
            <p className={`flex items-center gap-2 rounded-2xl p-3 font-display text-lg font-bold ${correct ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
              {correct ? <Check size={ICON.lg} strokeWidth={3} aria-hidden /> : <X size={ICON.lg} strokeWidth={3} aria-hidden />}
              {correct ? 'ถูกต้อง!' : q.type === 'choice' ? `ยังไม่ถูก · คำตอบคือข้อ ${label(Number(q.answer) - 1)}` : q.type === 'short' ? `ยังไม่ถูก · คำตอบคือ ${q.answer}` : 'ไว้ทวนอีกครั้ง'}
            </p>
            {q.solution && (
              <details open={!correct} className="rounded-2xl bg-primary/10 p-3">
                <summary className="flex min-h-11 items-center gap-2 font-semibold"><Lightbulb size={ICON.sm} aria-hidden /> เฉลยจากหนังสือ</summary>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{q.solution}</p>
              </details>
            )}
            {!correct && (
              <div>
                <p className="mb-1 text-sm font-semibold" id="why">ผิดเพราะอะไร?</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="why">
                  {(Object.keys(MISTAKE_LABELS) as MistakeReason[]).filter((r) => r !== 'time' || minutes).map((r) => (
                    <button key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{MISTAKE_LABELS[r]}</button>
                  ))}
                </div>
              </div>
            )}
            <button className="chip" aria-pressed={asked} onClick={() => setAskTeacher(db, topic.id!, no, !asked)}>
              <CircleHelp size={ICON.sm} aria-hidden /> {asked ? 'จะถามครูวันเสาร์' : 'ถามครูวันเสาร์'}
            </button>
            <button className="btn-cta w-full py-3 text-base" onClick={next}>
              {idx + 1 < nos.length ? <>ข้อต่อไป <ArrowRight size={ICON.md} aria-hidden /></> : 'ดูผล'}
            </button>
          </div>
        )}
      </article>
      {seenBefore && !checked && (
        <p className="flex items-center gap-1.5 text-sm text-muted-fg"><RotateCcw size={ICON.sm} aria-hidden /> เคยทำข้อนี้แล้ว · ครั้งนี้นับเป็นการทวน</p>
      )}
    </div>
  );
}
