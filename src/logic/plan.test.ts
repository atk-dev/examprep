import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../db/defaults';
import { aheadBehind, currentPhase, dailyQuota, daysUntilExam, plannedDoneBy, studyDaysBetween } from './plan';

const s = { ...defaultSettings('2026-10-25'), setupDone: true };

describe('plan', () => {
  it('default phases count back from 27 Mar 2027', () => {
    expect(s.phase1End).toBe('2027-01-31');
    expect(s.phase2End).toBe('2027-02-28');
    expect(s.phase3End).toBe('2027-03-20');
  });

  it('days until exam', () => {
    expect(daysUntilExam(s, '2026-10-25')).toBe(153);
    expect(daysUntilExam(s, '2027-03-26')).toBe(1);
  });

  it('counts study days skipping rest weekdays', () => {
    expect(studyDaysBetween('2026-10-25', '2026-10-31', [])).toBe(7);
    expect(studyDaysBetween('2026-10-25', '2026-10-31', [0])).toBe(6); // 25 Oct 2026 is a Sunday
    expect(studyDaysBetween('2026-10-31', '2026-10-25', [])).toBe(0);
  });

  it('quota spreads 1600 over phase 1 (99 days)', () => {
    expect(dailyQuota(s, '2026-10-25', 1600, 0)).toBe(17);
  });

  it('quota stays the same during the day as problems are logged', () => {
    expect(dailyQuota(s, '2026-10-25', 1590, 10)).toBe(17);
  });

  it('quota is 0 on rest days and when nothing is left', () => {
    const rest = { ...s, restWeekdays: [0] };
    expect(dailyQuota(rest, '2026-10-25', 1600, 0)).toBe(0);
    expect(dailyQuota(s, '2026-11-01', 0, 0)).toBe(0);
  });

  it('after phase 1 ends, quota is everything left', () => {
    expect(dailyQuota(s, '2027-02-05', 40, 0)).toBe(40);
  });

  it('planned curve and ahead/behind', () => {
    expect(plannedDoneBy(s, '2027-01-31', 1600)).toBe(1600);
    expect(plannedDoneBy(s, '2027-03-01', 1600)).toBe(1600);
    expect(aheadBehind(s, '2026-10-25', 0, 1600)).toBe(0);
    // by end of day 1 the plan is ~16; on day 2 with 30 done we are ahead
    expect(aheadBehind(s, '2026-10-26', 30, 1600)).toBe(30 - plannedDoneBy(s, '2026-10-25', 1600));
  });

  it('current phase', () => {
    expect(currentPhase(s, '2026-10-25')?.id).toBe('phase1');
    expect(currentPhase(s, '2027-01-31')?.id).toBe('phase1');
    expect(currentPhase(s, '2027-02-01')?.id).toBe('phase2');
    expect(currentPhase(s, '2027-03-15')?.id).toBe('phase3');
    expect(currentPhase(s, '2027-03-26')?.id).toBe('final');
    expect(currentPhase(s, '2027-03-27')).toBeNull();
  });
});
