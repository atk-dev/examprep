import type { Attempt, ISODate, MistakeReason, ProblemState, Subject, Topic } from '../types';
import { addDaysISO } from './dates';

export interface TopicProgress {
  topic: Topic;
  done: number; // problems attempted at least once
  firstCorrect: number;
  accuracy: number | null; // first-try accuracy 0..1
  open: number; // wrong or still reviewing
  level: 'none' | 'weak' | 'ok' | 'strong';
}

export interface SubjectProgress {
  subject: Subject;
  total: number;
  done: number;
  firstCorrect: number;
  accuracy: number | null;
  open: number;
  topics: TopicProgress[];
  lastDate: ISODate | null;
}

export function levelFor(done: number, total: number, accuracy: number | null): TopicProgress['level'] {
  if (done === 0 || accuracy === null) return 'none';
  if (accuracy < 0.6) return 'weak';
  if (accuracy < 0.8 || done < total) return 'ok';
  return 'strong';
}

export function subjectProgress(subjects: Subject[], topics: Topic[], states: ProblemState[]): SubjectProgress[] {
  const byTopic = new Map<number, ProblemState[]>();
  for (const s of states) {
    const list = byTopic.get(s.topicId) ?? [];
    list.push(s);
    byTopic.set(s.topicId, list);
  }
  return [...subjects]
    .sort((a, b) => a.order - b.order)
    .map((subject) => {
      const tps = topics
        .filter((t) => t.subjectId === subject.id)
        .sort((a, b) => a.order - b.order)
        .map((topic): TopicProgress => {
          const list = (byTopic.get(topic.id!) ?? []).filter((s) => s.problemNo <= topic.problemCount);
          const done = list.length;
          const firstCorrect = list.filter((s) => s.firstResult === 'correct').length;
          const accuracy = done ? firstCorrect / done : null;
          const open = list.filter((s) => s.status === 'wrong' || s.status === 'reviewing').length;
          return { topic, done, firstCorrect, accuracy, open, level: levelFor(done, topic.problemCount, accuracy) };
        });
      const total = tps.reduce((n, t) => n + t.topic.problemCount, 0);
      const done = tps.reduce((n, t) => n + t.done, 0);
      const firstCorrect = tps.reduce((n, t) => n + t.firstCorrect, 0);
      const topicIds = new Set(tps.map((t) => t.topic.id));
      const lastDate = states
        .filter((s) => topicIds.has(s.topicId))
        .reduce<ISODate | null>((m, s) => (m === null || s.lastDate > m ? s.lastDate : m), null);
      return {
        subject,
        total,
        done,
        firstCorrect,
        accuracy: done ? firstCorrect / done : null,
        open: tps.reduce((n, t) => n + t.open, 0),
        topics: tps,
        lastDate,
      };
    });
}

/** Consecutive days with at least one attempt, ending today (or yesterday if nothing yet today). */
export function streak(attempts: Attempt[], today: ISODate): number {
  const days = new Set(attempts.map((a) => a.date));
  let d = days.has(today) ? today : addDaysISO(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDaysISO(d, -1);
  }
  return n;
}

export function mistakeBreakdown(attempts: Attempt[]): Record<MistakeReason, number> {
  const out: Record<MistakeReason, number> = { concept: 0, careless: 0, time: 0, misread: 0 };
  for (const a of attempts) if (a.result === 'wrong' && a.reason) out[a.reason]++;
  return out;
}

export const MISTAKE_LABELS: Record<MistakeReason, string> = {
  concept: 'ไม่เข้าใจเนื้อหา',
  careless: 'สะเพร่า',
  time: 'ไม่ทันเวลา',
  misread: 'อ่านโจทย์ผิด',
};
