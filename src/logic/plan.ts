import type { ISODate, Settings } from '../types';
import { addDaysISO, diffDays, weekday } from './dates';

export type PhaseId = 'phase1' | 'phase2' | 'phase3' | 'final' | 'done';

export interface PhaseInfo {
  id: PhaseId;
  name: string;
  goal: string;
  start: ISODate;
  end: ISODate;
}

/** Default phase boundaries, counted back from the exam date. */
export function defaultPhases(examDate: ISODate) {
  return {
    phase3End: addDaysISO(examDate, -7),
    phase2End: addDaysISO(examDate, -27),
    phase1End: addDaysISO(examDate, -55),
  };
}

export function phases(s: Settings): PhaseInfo[] {
  return [
    { id: 'phase1', name: 'รอบแรก: ทำโจทย์ให้ครบ', goal: 'อ่านสรุปแล้วทำโจทย์ทุกข้อในหัวข้อ', start: s.startDate, end: s.phase1End },
    { id: 'phase2', name: 'แก้จุดอ่อน', goal: 'ทวนข้อที่ผิดและหัวข้อที่ทำได้น้อย', start: addDaysISO(s.phase1End, 1), end: s.phase2End },
    { id: 'phase3', name: 'ฝึกจับเวลา', goal: 'ทำโจทย์คละวิชาแบบจับเวลา', start: addDaysISO(s.phase2End, 1), end: s.phase3End },
    { id: 'final', name: 'สัปดาห์สุดท้าย', goal: 'ทวนสมุดข้อผิดเบาๆ พักผ่อนให้พอ', start: addDaysISO(s.phase3End, 1), end: addDaysISO(s.examDate, -1) },
  ];
}

export function currentPhase(s: Settings, today: ISODate): PhaseInfo | null {
  if (diffDays(today, s.examDate) >= 0) return null;
  return phases(s).find((p) => diffDays(today, p.end) <= 0) ?? null;
}

export const isRestDay = (s: Settings, d: ISODate) => s.restWeekdays.includes(weekday(d));

/** Study days in [from, to], both inclusive, skipping rest weekdays. */
export function studyDaysBetween(from: ISODate, to: ISODate, restWeekdays: number[]): number {
  const n = diffDays(to, from);
  if (n < 0) return 0;
  let count = 0;
  for (let i = 0; i <= n; i++) {
    if (!restWeekdays.includes(weekday(addDaysISO(from, i)))) count++;
  }
  return count;
}

export const daysUntilExam = (s: Settings, today: ISODate) => diffDays(s.examDate, today);

/**
 * How many new problems to do today so the first pass finishes by phase1End.
 * `remainingNew` is what is left now; `doneTodayNew` is what was already done today,
 * so the quota stays stable through the day instead of shrinking as you log.
 */
export function dailyQuota(
  s: Settings,
  today: ISODate,
  remainingNew: number,
  doneTodayNew: number,
): number {
  const leftAtStartOfDay = remainingNew + doneTodayNew;
  if (leftAtStartOfDay <= 0) return 0;
  if (diffDays(today, s.phase1End) > 0) return leftAtStartOfDay; // behind: finish the rest asap
  if (isRestDay(s, today)) return 0;
  const days = studyDaysBetween(today, s.phase1End, s.restWeekdays);
  return Math.ceil(leftAtStartOfDay / Math.max(days, 1));
}

/** Planned cumulative new problems done by end of `date`, on a straight line over study days. */
export function plannedDoneBy(s: Settings, date: ISODate, total: number): number {
  const totalDays = studyDaysBetween(s.startDate, s.phase1End, s.restWeekdays);
  if (totalDays <= 0) return total;
  const end = diffDays(date, s.phase1End) > 0 ? s.phase1End : date;
  const elapsed = studyDaysBetween(s.startDate, end, s.restWeekdays);
  return Math.min(total, Math.round((total * elapsed) / totalDays));
}

/** Positive = ahead of plan, negative = behind. Compares against plan up to yesterday. */
export function aheadBehind(s: Settings, today: ISODate, done: number, total: number): number {
  return done - plannedDoneBy(s, addDaysISO(today, -1), total);
}
