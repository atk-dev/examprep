import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { subjectProgress } from '../logic/stats';
import type { PlanTask } from '../plan/planSchema';
import type { TaskCtx } from '../plan/progress';
import type { Passage, ProblemNote, ProblemState, Question, Topic } from '../types';

/** Everything the screens need, kept live from IndexedDB. Data is small (a few thousand rows). */
export function useAppData() {
  const data = useLiveQuery(async () => {
    const [settings, subjects, topics, states, attempts, dailyLogs, notes, mockSets, plan, taskDone, mockExams, questions, passages] = await Promise.all([
      db.settings.get('main'),
      db.subjects.orderBy('order').toArray(),
      db.topics.orderBy('order').toArray(),
      db.problemStates.toArray(),
      db.attempts.toArray(),
      db.dailyLogs.toArray(),
      db.problemNotes.toArray(),
      db.mockSets.orderBy('id').toArray(),
      db.plan.get('main'),
      db.taskDone.toArray(),
      db.mockExams.orderBy('n').toArray(),
      db.questions.toArray(),
      db.passages.toArray(),
    ]);
    return {
      settings, subjects, topics, states, attempts, dailyLogs, mockSets, taskDone, mockExams,
      notes: new Map(notes.map((n) => [n.key, n.text])),
      noteRows: new Map<string, ProblemNote>(notes.map((n) => [n.key, n])),
      plan: plan?.plan ?? null,
      questions, passages,
    };
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
    const topicByKey = new Map<string, Topic>(data.topics.filter((t) => t.key).map((t) => [t.key!, t]));
    // questions by topic id → problem number
    const questionsByTopic = new Map<number, Map<number, Question>>();
    for (const q of data.questions) {
      const t = topicByKey.get(q.setKey);
      if (!t) continue;
      if (!questionsByTopic.has(t.id!)) questionsByTopic.set(t.id!, new Map());
      questionsByTopic.get(t.id!)!.set(q.no, q);
    }
    const passageById = new Map<string, Passage>(data.passages.map((p) => [p.id, p]));
    const planMode = data.settings?.planMode === 'plan' && !!data.plan;
    const tasks: PlanTask[] = planMode ? data.plan!.tasks : [];
    const taskCtx: TaskCtx = {
      topicByKey,
      statesByTopic,
      doneIds: new Set(data.taskDone.map((d) => d.taskId)),
      mockExams: data.mockExams,
    };
    const subjectByKey = new Map(data.subjects.filter((s) => s.key).map((s) => [s.key!, s]));
    return { progress, total, done, statesByTopic, firstUntried, topicByKey, questionsByTopic, passageById, planMode, tasks, taskCtx, subjectByKey };
  }, [data]);

  return data && derived ? { ...data, ...derived } : null;
}

export type AppData = NonNullable<ReturnType<typeof useAppData>>;
