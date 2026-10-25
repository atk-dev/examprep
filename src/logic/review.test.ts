import { describe, expect, it } from 'vitest';
import { applyAttempt, dueReviews, rebuildStates } from './review';
import type { Attempt } from '../types';

const p = { topicId: 1, problemNo: 5 };

describe('review scheduling', () => {
  it('correct on first try needs no review', () => {
    const s = applyAttempt(undefined, { ...p, date: '2026-10-25', result: 'correct' });
    expect(s.status).toBe('done');
    expect(s.nextReview).toBeNull();
  });

  it('wrong -> 1 -> 3 -> 7 days -> mastered', () => {
    let s = applyAttempt(undefined, { ...p, date: '2026-10-25', result: 'wrong', reason: 'careless' });
    expect(s).toMatchObject({ status: 'wrong', nextReview: '2026-10-26', lastReason: 'careless', firstResult: 'wrong' });
    s = applyAttempt(s, { ...p, date: '2026-10-26', result: 'correct' });
    expect(s).toMatchObject({ status: 'reviewing', box: 1, nextReview: '2026-10-29' });
    s = applyAttempt(s, { ...p, date: '2026-10-29', result: 'correct' });
    expect(s).toMatchObject({ status: 'reviewing', box: 2, nextReview: '2026-11-05' });
    s = applyAttempt(s, { ...p, date: '2026-11-05', result: 'correct' });
    expect(s).toMatchObject({ status: 'mastered', nextReview: null, attempts: 4, wrongCount: 1 });
  });

  it('wrong during review resets to box 0', () => {
    let s = applyAttempt(undefined, { ...p, date: '2026-10-25', result: 'wrong' });
    s = applyAttempt(s, { ...p, date: '2026-10-26', result: 'correct' });
    s = applyAttempt(s, { ...p, date: '2026-10-29', result: 'wrong', reason: 'concept' });
    expect(s).toMatchObject({ status: 'wrong', box: 0, nextReview: '2026-10-30', wrongCount: 2, lastReason: 'concept' });
  });

  it('due list and rebuild', () => {
    const attempts: Attempt[] = [
      { topicId: 1, problemNo: 1, date: '2026-10-25', result: 'wrong', isReview: false, createdAt: 1 },
      { topicId: 1, problemNo: 2, date: '2026-10-25', result: 'correct', isReview: false, createdAt: 2 },
      { topicId: 1, problemNo: 3, date: '2026-10-26', result: 'wrong', isReview: false, createdAt: 3 },
    ];
    const states = [...rebuildStates(attempts).values()];
    expect(dueReviews(states, '2026-10-25')).toHaveLength(0);
    expect(dueReviews(states, '2026-10-26').map((s) => s.problemNo)).toEqual([1]);
    expect(dueReviews(states, '2026-10-28').map((s) => s.problemNo)).toEqual([1, 3]);
  });
});
