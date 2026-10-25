import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../db/defaults';
import { rebuildStates } from './review';
import { subjectProgress } from './stats';
import { dailyCounts, planGap, planVsActual, reportText, weakTopics, weekSummary } from './insights';
import { plannedDoneBy } from './plan';
import type { Attempt, Subject, Topic } from '../types';

const s = { ...defaultSettings('2026-10-25'), setupDone: true };
const subjects: Subject[] = [{ id: 1, name: 'คณิตศาสตร์', color: '#000', order: 0 }];
const topics: Topic[] = [{ id: 10, subjectId: 1, name: 'เศษส่วน', order: 0, problemCount: 20, summaryRead: true }];
let c = 0;
const mk = (problemNo: number, date: string, result: 'correct' | 'wrong', isReview = false): Attempt => ({
  topicId: 10, problemNo, date, result, isReview, createdAt: c++, reason: result === 'wrong' ? 'careless' : undefined,
});
const attempts: Attempt[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => mk(n, '2026-10-25', n <= 3 ? 'wrong' : 'correct')),
  mk(7, '2026-10-27', 'correct'),
  mk(1, '2026-10-26', 'correct', true),
];
const states = [...rebuildStates(attempts).values()];
const progress = subjectProgress(subjects, topics, states);

describe('insights', () => {
  it('daily counts', () => {
    expect(dailyCounts(attempts).get('2026-10-25')).toEqual({ total: 6, correct: 3, wrong: 3, review: 0 });
    expect(dailyCounts(attempts).get('2026-10-26')?.review).toBe(1);
  });

  it('plan vs actual is cumulative and stops at today', () => {
    const pts = planVsActual(s, states, 20, '2026-10-27');
    expect(pts[0]).toMatchObject({ date: '2026-10-25', actual: 6 });
    expect(pts[2]).toMatchObject({ date: '2026-10-27', actual: 7 });
    expect(pts[3].actual).toBeNull();
    expect(pts.at(-1)).toMatchObject({ date: '2027-01-31', plan: 20 });
  });

  it('weak topics need enough tries', () => {
    expect(weakTopics(progress, 5)).toHaveLength(1);
    expect(weakTopics(progress, 10)).toHaveLength(0);
  });

  it('week summary and report text', () => {
    const w = weekSummary(attempts, states, [{ date: '2026-10-26', minutes: 45 }], '2026-10-27');
    expect(w).toMatchObject({ newDone: 7, reviewed: 1, activeDays: 3, minutes: 45 });
    expect(w.accuracy).toBeCloseTo(4 / 7);
    expect(w.mistakes.careless).toBe(3);
    const text = reportText({ settings: s, today: '2026-10-27', week: w, progress, states, done: 7, total: 20, attempts });
    expect(text).toContain('โจทย์ใหม่ 7 ข้อ');
    expect(text).toContain('คณิตศาสตร์ 7/20');
    expect(text).toContain('ผิดบ่อยเพราะ: สะเพร่า');
    // gap ignores today's work: 6 done before 27 Oct vs plan through 26 Oct
    expect(text).toContain(`นำแผน ${planGap(s, '2026-10-27', states, 20)} ข้อ`);
    expect(planGap(s, '2026-10-27', states, 20)).toBe(6 - plannedDoneBy(s, '2026-10-26', 20));
  });
});
