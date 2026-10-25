import { describe, expect, it } from 'vitest';
import { mistakeBreakdown, streak, subjectProgress } from './stats';
import { suggestToday } from './suggest';
import { rebuildStates } from './review';
import type { Attempt, Subject, Topic } from '../types';

const subjects: Subject[] = [
  { id: 1, name: 'คณิต', color: '#000', order: 0 },
  { id: 2, name: 'วิทย์', color: '#000', order: 1 },
];
const topics: Topic[] = [
  { id: 10, subjectId: 1, name: 'เศษส่วน', order: 0, problemCount: 4, summaryRead: true },
  { id: 11, subjectId: 1, name: 'ทศนิยม', order: 1, problemCount: 10, summaryRead: false },
  { id: 20, subjectId: 2, name: 'แรง', order: 0, problemCount: 10, summaryRead: false },
];
const mk = (topicId: number, problemNo: number, date: string, result: 'correct' | 'wrong', reason?: Attempt['reason']): Attempt => ({
  topicId, problemNo, date, result, reason, isReview: false, createdAt: problemNo,
});
const attempts = [
  mk(10, 1, '2026-10-24', 'correct'),
  mk(10, 2, '2026-10-24', 'wrong', 'careless'),
  mk(10, 3, '2026-10-25', 'correct'),
  mk(10, 4, '2026-10-25', 'wrong', 'concept'),
];

describe('stats', () => {
  const prog = subjectProgress(subjects, topics, [...rebuildStates(attempts).values()]);

  it('subject and topic progress', () => {
    expect(prog[0]).toMatchObject({ total: 14, done: 4, firstCorrect: 2, accuracy: 0.5, open: 2, lastDate: '2026-10-25' });
    expect(prog[0].topics[0].level).toBe('weak');
    expect(prog[1]).toMatchObject({ total: 10, done: 0, accuracy: null, lastDate: null });
  });

  it('streak', () => {
    expect(streak(attempts, '2026-10-25')).toBe(2);
    expect(streak(attempts, '2026-10-26')).toBe(2);
    expect(streak(attempts, '2026-10-27')).toBe(0);
  });

  it('mistake breakdown', () => {
    expect(mistakeBreakdown(attempts)).toEqual({ concept: 1, careless: 1, time: 0, misread: 0 });
  });

  it('suggests unfinished topics, splitting the quota', () => {
    const sug = suggestToday(prog, 10, '2026-10-26', () => 1);
    expect(sug).toHaveLength(2);
    expect(sug.reduce((n, x) => n + x.count, 0)).toBe(10);
    const math = sug.find((x) => x.subject.subject.id === 1)!;
    expect(math.topic.topic.id).toBe(11); // fractions finished, next is decimals
    expect(math.readSummaryFirst).toBe(true);
    // science untouched for a long time -> ranked first
    expect(sug[0].subject.subject.id).toBe(2);
  });

  it('no suggestions when quota is 0', () => {
    expect(suggestToday(prog, 0, '2026-10-26', () => 1)).toEqual([]);
  });
});
