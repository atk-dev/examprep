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

/** Problem ranges a task counts toward completion: `set/from/to` plus any ranged `sets` entries (1.1). */
export function taskRanges(t: PlanTask): { set: string; from: number; to: number }[] {
  const out: { set: string; from: number; to: number }[] = [];
  if (t.set && t.from && t.to) out.push({ set: t.set, from: t.from, to: t.to });
  for (const r of t.sets ?? []) if (r.from && r.to) out.push({ set: r.set, from: r.from, to: r.to });
  return out;
}

/** Tasks with problem ranges finish by themselves once every problem is answered. */
export function taskStatus(t: PlanTask, ctx: TaskCtx): TaskStatus {
  const manual = ctx.doneIds.has(t.id);
  if (t.type === 'mock') {
    const m = ctx.mockExams.find((x) => x.n === t.mock);
    return { done: manual || (!!m && Object.values(m.scores).some((v) => v !== null && v !== undefined)) };
  }
  const ranges = taskRanges(t).filter((r) => ctx.topicByKey.has(r.set));
  if (!ranges.length) return { done: manual };
  let answered = 0;
  let correct = 0;
  let size = 0;
  for (const r of ranges) {
    const states = ctx.statesByTopic.get(ctx.topicByKey.get(r.set)!.id!);
    size += r.to - r.from + 1;
    for (let n = r.from; n <= r.to; n++) {
      const s = states?.get(n);
      if (s) {
        answered++;
        if (s.firstResult === 'correct') correct++;
      }
    }
  }
  return { done: manual || answered === size, answered, size, correct };
}

/** The first range of a task that still has unanswered problems (where its button should go). */
export function nextRange(t: PlanTask, ctx: TaskCtx) {
  const ranges = taskRanges(t).filter((r) => ctx.topicByKey.has(r.set));
  return (
    ranges.find((r) => {
      const states = ctx.statesByTopic.get(ctx.topicByKey.get(r.set)!.id!);
      for (let n = r.from; n <= r.to; n++) if (!states?.has(n)) return true;
      return false;
    }) ?? ranges[0]
  );
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
  for (const t of tasks) for (const r of taskRanges(t)) planned.set(t.date, (planned.get(t.date) ?? 0) + r.to - r.from + 1);
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
