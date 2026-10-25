import type { Attempt, DailyLog, ISODate, MistakeReason, ProblemState, Settings } from '../types';
import { addDaysISO, diffDays, formatThai } from './dates';
import { aheadBehind, currentPhase, daysUntilExam, plannedDoneBy } from './plan';
import { MISTAKE_LABELS, mistakeBreakdown, streak, type SubjectProgress, type TopicProgress } from './stats';

export interface DayCount {
  total: number;
  correct: number;
  wrong: number;
  review: number;
}

export function dailyCounts(attempts: Attempt[]): Map<ISODate, DayCount> {
  const m = new Map<ISODate, DayCount>();
  for (const a of attempts) {
    const d = m.get(a.date) ?? { total: 0, correct: 0, wrong: 0, review: 0 };
    d.total++;
    if (a.result === 'correct') d.correct++;
    else d.wrong++;
    if (a.isReview) d.review++;
    m.set(a.date, d);
  }
  return m;
}

export interface PlanPoint {
  date: ISODate;
  plan: number;
  actual: number | null; // null after today
}

/** One point per day from startDate to phase1End (or today, if later). */
export function planVsActual(s: Settings, states: ProblemState[], total: number, today: ISODate): PlanPoint[] {
  const firstByDay = new Map<ISODate, number>();
  for (const st of states) firstByDay.set(st.firstDate, (firstByDay.get(st.firstDate) ?? 0) + 1);
  // count anything done before the plan started on day one
  let cum = states.filter((st) => st.firstDate < s.startDate).length;
  const end = diffDays(today, s.phase1End) > 0 ? today : s.phase1End;
  const n = diffDays(end, s.startDate);
  const out: PlanPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const date = addDaysISO(s.startDate, i);
    cum += firstByDay.get(date) ?? 0;
    out.push({ date, plan: plannedDoneBy(s, date, total), actual: date <= today ? cum : null });
  }
  return out;
}

/** Weakest topics: enough tries to judge, lowest first-try accuracy first. */
export function weakTopics(progress: SubjectProgress[], minDone = 5, limit = 5) {
  return progress
    .flatMap((p) => p.topics.map((t) => ({ subject: p.subject, t })))
    .filter((x): x is { subject: SubjectProgress['subject']; t: TopicProgress & { accuracy: number } } =>
      x.t.done >= minDone && x.t.accuracy !== null && x.t.accuracy < 0.8,
    )
    .sort((a, b) => a.t.accuracy - b.t.accuracy)
    .slice(0, limit);
}

export interface WeekSummary {
  from: ISODate;
  to: ISODate;
  newDone: number;
  reviewed: number;
  accuracy: number | null; // first-try accuracy of new problems this week
  activeDays: number;
  minutes: number;
  mistakes: Record<MistakeReason, number>;
  perDay: { date: ISODate; total: number }[];
}

export function weekSummary(attempts: Attempt[], states: ProblemState[], logs: DailyLog[], today: ISODate): WeekSummary {
  const from = addDaysISO(today, -6);
  const inWeek = (d: ISODate) => d >= from && d <= today;
  const week = attempts.filter((a) => inWeek(a.date));
  const fresh = states.filter((s) => inWeek(s.firstDate));
  const counts = dailyCounts(week);
  return {
    from,
    to: today,
    newDone: fresh.length,
    reviewed: week.filter((a) => a.isReview).length,
    accuracy: fresh.length ? fresh.filter((s) => s.firstResult === 'correct').length / fresh.length : null,
    activeDays: counts.size,
    minutes: logs.filter((l) => inWeek(l.date)).reduce((n, l) => n + l.minutes, 0),
    mistakes: mistakeBreakdown(week),
    perDay: Array.from({ length: 7 }, (_, i) => {
      const date = addDaysISO(from, i);
      return { date, total: counts.get(date)?.total ?? 0 };
    }),
  };
}

/** Ahead (+) or behind (−) plan, counting work through yesterday so today's logging doesn't skew it. */
export function planGap(s: Settings, today: ISODate, states: ProblemState[], total: number): number {
  return aheadBehind(s, today, states.filter((x) => x.firstDate < today).length, total);
}

const pctText = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

/** Plain-text weekly report, sized for a LINE message. */
export function reportText(args: {
  settings: Settings;
  today: ISODate;
  week: WeekSummary;
  progress: SubjectProgress[];
  states: ProblemState[];
  done: number;
  total: number;
  attempts: Attempt[];
}): string {
  const { settings: s, today, week, progress, states, done, total, attempts } = args;
  const gap = planGap(s, today, states, total);
  const phase = currentPhase(s, today);
  const weak = weakTopics(progress, 5, 3);
  const topReason = (Object.entries(week.mistakes) as [MistakeReason, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const lines = [
    `📚 รายงานประจำสัปดาห์ (${formatThai(week.from)} – ${formatThai(week.to)})`,
    `${s.examName}: อีก ${Math.max(daysUntilExam(s, today), 0)} วัน${phase ? ` · ${phase.name}` : ''}`,
    '',
    `✏️ โจทย์ใหม่ ${week.newDone} ข้อ · ทวน ${week.reviewed} ข้อ`,
    `🎯 ถูกครั้งแรก ${pctText(week.accuracy)}`,
    `📅 เรียน ${week.activeDays}/7 วัน · ${week.minutes} นาที · ต่อเนื่อง ${streak(attempts, today)} วัน`,
    `📈 รวม ${done}/${total} ข้อ (${pctText(total ? done / total : 0)}) ${gap >= 0 ? `✅ นำแผน ${gap} ข้อ` : `⚠️ ช้ากว่าแผน ${-gap} ข้อ`}`,
    '',
    'รายวิชา:',
    ...progress
      .filter((p) => p.total > 0)
      .map((p) => `• ${p.subject.name} ${p.done}/${p.total} · ถูก ${pctText(p.accuracy)}`),
  ];
  if (weak.length) {
    lines.push('', 'ควรเสริม:', ...weak.map((w) => `• ${w.subject.name} – ${w.t.topic.name} (${pctText(w.t.accuracy)})`));
  }
  if (topReason) lines.push('', `ผิดบ่อยเพราะ: ${MISTAKE_LABELS[topReason[0]]} (${topReason[1]} ข้อ)`);
  return lines.join('\n');
}
