import { Link } from 'react-router-dom';
import { Check, CircleHelp, Library, RotateCcw, Timer } from 'lucide-react';
import { db } from '../db/db';
import { setAskTeacher, setTaskDone } from '../db/actions';
import type { AppData } from '../hooks/useAppData';
import { formatThai } from '../logic/dates';
import { weakTopics } from '../logic/insights';
import type { PlanTask } from '../plan/planSchema';
import { taskStatus } from '../plan/progress';
import { ICON, ProgressBar, pct } from './ui';

export const TASK_LABEL: Record<PlanTask['type'], string> = {
  practice: 'โจทย์ท้ายบท', timed: 'Pretest จับเวลา', reviewWrong: 'ไล่ข้อที่ผิด', subjectReview: 'ทบทวน',
  saturday: 'เสาร์ทวนสะสม', mock: 'สอบจำลอง', catchup: 'วันเก็บตก', kickoff: 'เริ่มต้น', exam: 'วันสอบ',
};

/** Where a task's main button goes. */
export function taskLink(t: PlanTask, data: AppData): string | null {
  const topic = t.set ? data.topicByKey.get(t.set) : undefined;
  if (topic && t.from && t.to) return `/log?topic=${topic.id}&from=${t.from}&to=${t.to}${t.minutes ? `&minutes=${t.minutes}` : ''}`;
  if (t.type === 'reviewWrong' || t.type === 'subjectReview') {
    const subject = t.subject ? data.subjectByKey.get(t.subject) : undefined;
    return `/review?tab=notebook${subject ? `&subject=${subject.id}` : ''}`;
  }
  if (t.type === 'saturday') return '/review';
  if (t.type === 'mock') return '/mock?tab=exam';
  return null;
}

export function SubjectTag({ subjectKey, data }: { subjectKey?: string; data: AppData }) {
  const s = subjectKey ? data.subjectByKey.get(subjectKey) : undefined;
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-fg">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
      {s.name}
    </span>
  );
}

function ManualCheck({ t, done }: { t: PlanTask; done: boolean }) {
  return (
    <button className="chip" aria-pressed={done} onClick={() => setTaskDone(db, t.id, !done)}>
      <Check size={ICON.sm} aria-hidden /> {done ? 'ทำแล้ว' : 'ทำเสร็จแล้ว'}
    </button>
  );
}

/** One plan task with its progress and actions. `compact` = row style for lists. */
export default function TaskCard({ t, data, compact = false }: { t: PlanTask; data: AppData; compact?: boolean }) {
  const st = taskStatus(t, data.taskCtx);
  const link = taskLink(t, data);
  const subject = t.subject ? data.subjectByKey.get(t.subject) : undefined;
  const topic = t.set ? data.topicByKey.get(t.set) : undefined;
  const hasQuiz = topic ? data.questionsByTopic.has(topic.id!) : false;
  const auto = st.size !== undefined;

  if (compact) {
    return (
      <Link to={link ?? '/progress?tab=plan'} className="flex min-h-14 items-center gap-3 rounded-2xl bg-muted/60 p-3 active:bg-muted">
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: subject?.color ?? 'var(--color-border)' }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-fg">{formatThai(t.date)} · {TASK_LABEL[t.type]}{subject ? ` · ${subject.name}` : ''}</span>
          <span className="block truncate font-semibold">{t.title}</span>
        </span>
        {auto && <span className="shrink-0 text-xs text-muted-fg">{st.answered}/{st.size}</span>}
      </Link>
    );
  }

  const openWrong = topic ? [...(data.statesByTopic.get(topic.id!)?.values() ?? [])].filter((s) => s.status === 'wrong' || s.status === 'reviewing').length : 0;
  const weak = t.type === 'subjectReview' ? weakTopics(data.progress.filter((p) => p.subject.key === t.subject), 3, 3) : [];
  const ask = t.type === 'saturday' ? [...data.noteRows.values()].filter((n) => n.askTeacher) : [];

  return (
    <section className="card space-y-3" style={{ borderLeft: subject ? `6px solid ${subject.color}` : undefined }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{TASK_LABEL[t.type]}</span>
        <SubjectTag subjectKey={t.subject} data={data} />
      </div>
      <h2 className="text-xl font-bold">{t.title}</h2>
      {t.note && <p className="text-sm text-muted-fg">{t.note}</p>}
      {t.minutes ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          <Timer size={ICON.sm} aria-hidden /> จับเวลา {t.minutes} นาที
        </p>
      ) : null}

      {auto && (
        <div>
          <ProgressBar value={st.answered! / st.size!} color={subject?.color} />
          <p className="mt-1 text-sm text-muted-fg">
            ทำแล้ว {st.answered}/{st.size} ข้อ
            {st.answered ? ` · ถูกครั้งแรก ${st.correct}/${st.answered} (${pct(st.correct! / st.answered!)})` : ''}
          </p>
        </div>
      )}
      {t.type === 'reviewWrong' && <p className="text-sm">ข้อที่ยังผิดในชุดนี้: <b>{openWrong}</b> ข้อ</p>}
      {weak.length > 0 && (
        <ul className="text-sm">
          {weak.map((w) => <li key={w.t.topic.id}>• {w.t.topic.name} <b>({pct(w.t.accuracy)})</b></li>)}
        </ul>
      )}
      {t.type === 'saturday' && (
        <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold"><CircleHelp size={ICON.sm} aria-hidden /> ข้อที่จะถามครู ({ask.length})</p>
          {ask.length ? (
            <ul className="space-y-1.5">
              {ask.map((n) => {
                const tp = data.topics.find((x) => x.id === n.topicId);
                const no = Number(n.key.split(':')[1]);
                return (
                  <li key={n.key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{tp?.name ?? '?'} · <b>ข้อ {no}</b>{n.text ? ` · ${n.text}` : ''}</span>
                    <button className="chip shrink-0" onClick={() => setAskTeacher(db, n.topicId, no, false)}>ถามแล้ว</button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-fg">ยังไม่มี · กด "ถามครูวันเสาร์" ตอนทำโจทย์</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {link && !st.done && (
          <Link to={link} className="btn-cta flex-1 py-3 text-base">
            {t.type === 'practice' || t.type === 'timed' ? (hasQuiz ? 'เริ่มทำโจทย์' : 'บันทึกผลจากหนังสือ')
              : t.type === 'reviewWrong' ? 'ไล่ข้อที่ผิด' : t.type === 'saturday' ? 'ทวนข้อที่ถึงกำหนด'
                : t.type === 'mock' ? 'บันทึกคะแนนสอบจำลอง' : 'เปิดสมุดข้อผิด'}
          </Link>
        )}
        {t.type === 'reviewWrong' && topic && t.from && !st.done && (
          <Link to={`/log?topic=${topic.id}&from=${t.from}&to=${t.to}`} className="btn-ghost flex-1">
            <Library size={ICON.sm} aria-hidden /> ทำข้อ {t.from}–{t.to}
          </Link>
        )}
        {st.done && link && (
          <Link to={link} className="btn-ghost flex-1"><RotateCcw size={ICON.sm} aria-hidden /> เปิดอีกครั้ง</Link>
        )}
        {!auto && t.type !== 'mock' && t.type !== 'exam' && <ManualCheck t={t} done={st.done} />}
      </div>
      {st.done && <p className="flex items-center gap-1.5 text-sm font-bold text-success"><Check size={ICON.sm} strokeWidth={3} aria-hidden /> เสร็จแล้ว</p>}
    </section>
  );
}
