import type { Attempt, ISODate, MistakeReason, ProblemState, Result } from '../types';
import { addDaysISO, diffDays } from './dates';

/** Days until the next review after passing box N. Passing the last box = mastered. */
export const REVIEW_INTERVALS = [1, 3, 7];

export const problemKey = (topicId: number, problemNo: number) => `${topicId}:${problemNo}`;

/** Apply one attempt to a problem's state (pure). */
export function applyAttempt(
  prev: ProblemState | undefined,
  a: { topicId: number; problemNo: number; date: ISODate; result: Result; reason?: MistakeReason },
): ProblemState {
  if (!prev) {
    const wrong = a.result === 'wrong';
    return {
      key: problemKey(a.topicId, a.problemNo),
      topicId: a.topicId,
      problemNo: a.problemNo,
      status: wrong ? 'wrong' : 'done',
      box: 0,
      nextReview: wrong ? addDaysISO(a.date, REVIEW_INTERVALS[0]) : null,
      firstDate: a.date,
      lastDate: a.date,
      firstResult: a.result,
      attempts: 1,
      wrongCount: wrong ? 1 : 0,
      lastReason: wrong ? a.reason : undefined,
    };
  }

  const base = { ...prev, lastDate: a.date, attempts: prev.attempts + 1 };

  if (a.result === 'wrong') {
    return {
      ...base,
      status: 'wrong',
      box: 0,
      nextReview: addDaysISO(a.date, REVIEW_INTERVALS[0]),
      wrongCount: prev.wrongCount + 1,
      lastReason: a.reason ?? prev.lastReason,
    };
  }

  // Correct. If the problem was never wrong (or already mastered), nothing to schedule.
  if (prev.status === 'done' || prev.status === 'mastered') return base;

  const box = prev.box + 1;
  if (box >= REVIEW_INTERVALS.length) {
    return { ...base, status: 'mastered', box, nextReview: null };
  }
  return { ...base, status: 'reviewing', box, nextReview: addDaysISO(a.date, REVIEW_INTERVALS[box]) };
}

/** Rebuild all states from the attempt history (used after import and in tests). */
export function rebuildStates(attempts: Attempt[]): Map<string, ProblemState> {
  const sorted = [...attempts].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
  const map = new Map<string, ProblemState>();
  for (const a of sorted) {
    const k = problemKey(a.topicId, a.problemNo);
    map.set(k, applyAttempt(map.get(k), a));
  }
  return map;
}

export const isDue = (s: ProblemState, today: ISODate) =>
  s.nextReview !== null && diffDays(s.nextReview, today) <= 0;

export function dueReviews(states: ProblemState[], today: ISODate): ProblemState[] {
  return states
    .filter((s) => isDue(s, today))
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : a.nextReview! > b.nextReview! ? 1 : a.problemNo - b.problemNo));
}
