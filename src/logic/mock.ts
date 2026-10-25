import type { MockItem, MockResult, MockSet, ProblemState, Subject, Topic } from '../types';
import { problemKey } from './review';

/** Small seeded PRNG (mulberry32) so sets are reproducible in tests. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How likely a problem is to be picked. Open mistakes matter most, then problems in
 * weak topics; everything else still shows up so the set feels like a real exam.
 */
export function pickWeight(state: ProblemState | undefined, topicAccuracy: number | null): number {
  let w = 1;
  if (state?.status === 'wrong' || state?.status === 'reviewing') w = 4;
  else if (!state) w = 1.5; // untried: still needs covering
  if (topicAccuracy !== null && topicAccuracy < 0.8) w *= 2;
  return w;
}

/**
 * Build a mixed set: the size is split evenly across the chosen subjects, problems are
 * drawn by weight without repeats, and the list is grouped by subject in book order.
 */
export function generateSet(args: {
  subjects: Subject[];
  topics: Topic[];
  states: Map<string, ProblemState>;
  subjectIds: number[];
  size: number;
  random?: () => number;
}): MockItem[] {
  const { subjects, topics, states, size } = args;
  const random = args.random ?? Math.random;
  const chosen = subjects.filter((s) => args.subjectIds.includes(s.id!)).sort((a, b) => a.order - b.order);

  const pools = chosen.map((sub) => {
    const pool: { item: MockItem; w: number }[] = [];
    for (const t of topics.filter((x) => x.subjectId === sub.id)) {
      const tried = [...Array(t.problemCount)].map((_, i) => states.get(problemKey(t.id!, i + 1)));
      const done = tried.filter(Boolean) as ProblemState[];
      const acc = done.length >= 3 ? done.filter((s) => s.firstResult === 'correct').length / done.length : null;
      tried.forEach((st, i) => pool.push({ item: { subjectId: sub.id!, topicId: t.id!, problemNo: i + 1 }, w: pickWeight(st, acc) }));
    }
    return pool;
  });

  // Even split; leftover seats go to subjects that still have problems available.
  const want = pools.map(() => 0);
  let left = Math.min(size, pools.reduce((n, p) => n + p.length, 0));
  while (left > 0) {
    let gave = false;
    for (let i = 0; i < pools.length && left > 0; i++) {
      if (want[i] < pools[i].length) {
        want[i]++;
        left--;
        gave = true;
      }
    }
    if (!gave) break;
  }

  const topicOrder = new Map(topics.map((t) => [t.id!, t.order]));
  return pools.flatMap((pool, i) => {
    const picked: MockItem[] = [];
    const bag = [...pool];
    for (let k = 0; k < want[i]; k++) {
      const total = bag.reduce((n, x) => n + x.w, 0);
      let r = random() * total;
      let j = 0;
      while (j < bag.length - 1 && (r -= bag[j].w) > 0) j++;
      picked.push(bag[j].item);
      bag.splice(j, 1);
    }
    return picked.sort((a, b) => topicOrder.get(a.topicId)! - topicOrder.get(b.topicId)! || a.problemNo - b.problemNo);
  });
}

export const remainingSec = (m: MockSet, now: number) =>
  Math.max(0, m.limitSec - Math.floor(((m.stoppedAt ?? now) - m.startedAt) / 1000));

export const usedSec = (m: MockSet, now: number) =>
  Math.min(m.limitSec, Math.floor(((m.stoppedAt ?? now) - m.startedAt) / 1000));

export function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface MockScore {
  correct: number;
  total: number;
  bySubject: { subjectId: number; correct: number; total: number }[];
}

export function scoreSet(items: MockItem[], results: MockResult[]): MockScore {
  const by = new Map<number, { subjectId: number; correct: number; total: number }>();
  items.forEach((it, i) => {
    const row = by.get(it.subjectId) ?? { subjectId: it.subjectId, correct: 0, total: 0 };
    row.total++;
    if (results[i]?.result === 'correct') row.correct++;
    by.set(it.subjectId, row);
  });
  const bySubject = [...by.values()];
  return { correct: bySubject.reduce((n, r) => n + r.correct, 0), total: items.length, bySubject };
}
