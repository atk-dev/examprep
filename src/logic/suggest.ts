import type { ISODate } from '../types';
import { diffDays } from './dates';
import type { SubjectProgress, TopicProgress } from './stats';

export interface Suggestion {
  subject: SubjectProgress;
  topic: TopicProgress;
  count: number;
  readSummaryFirst: boolean;
  /** First problem number not yet attempted in this topic. */
  startAt: number;
}

/**
 * Pick 2–3 subjects for today and the next topic in each.
 * Score favors subjects with more work left, lower accuracy, and longer time since last practice,
 * so every subject keeps coming back (interleaving) and weak ones get more turns.
 */
export function suggestToday(
  progress: SubjectProgress[],
  quota: number,
  today: ISODate,
  firstUntried: (topicId: number) => number,
): Suggestion[] {
  if (quota <= 0) return [];
  const candidates = progress.filter((p) => p.total - p.done > 0);
  if (!candidates.length) return [];
  const totalLeft = candidates.reduce((n, p) => n + (p.total - p.done), 0);

  const scored = candidates
    .map((p) => {
      const leftShare = (p.total - p.done) / totalLeft; // 0..1
      const weakness = p.accuracy === null ? 0.3 : 1 - p.accuracy; // 0..1
      const idle = p.lastDate ? Math.min(diffDays(today, p.lastDate), 7) / 7 : 1; // 0..1
      return { p, score: leftShare * 2 + weakness + idle * 1.5 };
    })
    .sort((a, b) => b.score - a.score);

  const howMany = Math.min(quota >= 20 ? 3 : quota >= 6 ? 2 : 1, scored.length);
  const picked = scored.slice(0, howMany);
  const scoreSum = picked.reduce((n, x) => n + x.score, 0);

  let assigned = 0;
  return picked.map((x, i) => {
    const topic = x.p.topics.find((t) => t.done < t.topic.problemCount)!;
    const left = quota - assigned;
    const share = i === picked.length - 1 ? left : Math.max(1, Math.round((quota * x.score) / scoreSum));
    const count = Math.min(share, left);
    assigned += count;
    return {
      subject: x.p,
      topic,
      count,
      readSummaryFirst: !topic.topic.summaryRead && topic.done === 0,
      startAt: firstUntried(topic.topic.id!),
    };
  });
}
