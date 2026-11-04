import type { ISODate, MockExam, ProblemState, Topic } from '../types';
import type { PlanTask } from './planSchema';

export interface TaskCtx {
  topicByKey: Map<string, Topic>;
  statesByTopic: Map<number, Map<number, ProblemState>>;
  doneIds: Set<string>;
  mockExams: MockExam[];
}

export interface TaskStatus {
  done: boolean;
  /** Problems answered in the task's range / size of the range. */
  answered?: number;
  size?: number;
  /** First-try correct answers in the range (the "ได้/เต็ม" score). */
  correct?: number;
}

const range = (t: PlanTask) => (t.from && t.to ? { from: t.from, to: t.to } : null);

/** Tasks with a problem range finish by themselves once every problem is answered. */
export function taskStatus(t: PlanTask, ctx: TaskCtx): TaskStatus {
  const manual = ctx.doneIds.has(t.id);
  if (t.type === 'mock') {
    const m = ctx.mockExams.find((x) => x.n === t.mock);
    return { done: manual || (!!m && Object.values(m.scores).some((v) => v !== null && v !== undefined)) };
  }
  const r = range(t);
  const topic = t.set ? ctx.topicByKey.get(t.set) : undefined;
  if (!r || !topic) return { done: manual };
  const states = ctx.statesByTopic.get(topic.id!);
  let answered = 0;
  let correct = 0;
  for (let n = r.from; n <= r.to; n++) {
    const s = states?.get(n);
    if (s) {
      answered++;
      if (s.firstResult === 'correct') correct++;
    }
  }
  const size = r.to - r.from + 1;
  return { done: manual || answered === size, answered, size, correct };
}

/** Everything except the exam itself can be ticked off. */
export const isCheckable = (t: PlanTask) => t.type !== 'exam';

/** Tasks scored like the paper score sheet (chapter and pretest days). */
export const isScored = (t: PlanTask) => t.type === 'practice' || t.type === 'timed' || t.type === 'reviewWrong';

export function overdue(tasks: PlanTask[], today: ISODate, ctx: TaskCtx): PlanTask[] {
  return tasks.filter((t) => t.date < today && isCheckable(t) && t.type !== 'kickoff' && !taskStatus(t, ctx).done);
}

/** Done minus scheduled, counting tasks up to yesterday (+ ahead / − behind). */
export function taskGap(tasks: PlanTask[], today: ISODate, ctx: TaskCtx) {
  const due = tasks.filter((t) => t.date < today && isCheckable(t) && t.type !== 'kickoff');
  const doneDue = due.filter((t) => taskStatus(t, ctx).done).length;
  const doneEarly = tasks.filter((t) => t.date >= today && isCheckable(t) && taskStatus(t, ctx).done).length;
  return { due: due.length, done: doneDue + doneEarly, gap: doneDue + doneEarly - due.length, missed: due.length - doneDue };
}

export const mockTotal = (m: MockExam | undefined) =>
  m ? Object.values(m.scores).reduce<number>((n, v) => n + (typeof v === 'number' ? v : 0), 0) : null;

/** Cumulative problems scheduled by the plan vs actually started, one point per day. */
export function planCurve(tasks: PlanTask[], states: ProblemState[], today: ISODate) {
  const planned = new Map<ISODate, number>();
  for (const t of tasks) if (t.from && t.to) planned.set(t.date, (planned.get(t.date) ?? 0) + t.to - t.from + 1);
  const firstByDay = new Map<ISODate, number>();
  for (const s of states) firstByDay.set(s.firstDate, (firstByDay.get(s.firstDate) ?? 0) + 1);
  const start = tasks[0]?.date;
  const end = [...planned.keys()].sort().pop();
  if (!start || !end) return [];
  const out: { date: ISODate; plan: number; actual: number | null }[] = [];
  let p = 0;
  let a = states.filter((s) => s.firstDate < start).length;
  for (let d = new Date(`${start}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    p += planned.get(iso) ?? 0;
    a += firstByDay.get(iso) ?? 0;
    out.push({ date: iso, plan: p, actual: iso <= today ? a : null });
    if (iso >= end) break;
  }
  return out;
}
