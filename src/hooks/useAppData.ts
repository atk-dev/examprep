import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { subjectProgress } from '../logic/stats';
import type { ProblemState } from '../types';

/** Everything the screens need, kept live from IndexedDB. Data is small (a few thousand rows). */
export function useAppData() {
  const data = useLiveQuery(async () => {
    const [settings, subjects, topics, states, attempts, dailyLogs, notes, mockSets] = await Promise.all([
      db.settings.get('main'),
      db.subjects.orderBy('order').toArray(),
      db.topics.orderBy('order').toArray(),
      db.problemStates.toArray(),
      db.attempts.toArray(),
      db.dailyLogs.toArray(),
      db.problemNotes.toArray(),
      db.mockSets.orderBy('id').toArray(),
    ]);
    return { settings, subjects, topics, states, attempts, dailyLogs, notes: new Map(notes.map((n) => [n.key, n.text])), mockSets };
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const progress = subjectProgress(data.subjects, data.topics, data.states);
    const total = progress.reduce((n, p) => n + p.total, 0);
    const done = progress.reduce((n, p) => n + p.done, 0);
    const statesByTopic = new Map<number, Map<number, ProblemState>>();
    for (const s of data.states) {
      if (!statesByTopic.has(s.topicId)) statesByTopic.set(s.topicId, new Map());
      statesByTopic.get(s.topicId)!.set(s.problemNo, s);
    }
    const firstUntried = (topicId: number) => {
      const t = data.topics.find((x) => x.id === topicId);
      const m = statesByTopic.get(topicId);
      if (!t) return 1;
      for (let i = 1; i <= t.problemCount; i++) if (!m?.has(i)) return i;
      return t.problemCount;
    };
    return { progress, total, done, statesByTopic, firstUntried };
  }, [data]);

  return data && derived ? { ...data, ...derived } : null;
}

export type AppData = NonNullable<ReturnType<typeof useAppData>>;
