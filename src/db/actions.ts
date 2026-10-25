import type { ExamDB } from './db';
import type { ISODate, MistakeReason, Result, Settings, Topic } from '../types';
import { applyAttempt, problemKey, rebuildStates } from '../logic/review';
import { DEFAULT_SUBJECTS } from './defaults';

export interface Mark {
  topicId: number;
  problemNo: number;
  result: Result;
  reason?: MistakeReason;
}

/** Save a practice session: write attempts and update each problem's review state. */
export async function saveMarks(db: ExamDB, marks: Mark[], date: ISODate, isReview: boolean) {
  if (!marks.length) return;
  await db.transaction('rw', db.attempts, db.problemStates, async () => {
    const now = Date.now();
    const keys = marks.map((m) => problemKey(m.topicId, m.problemNo));
    const prev = await db.problemStates.bulkGet(keys);
    const next = marks.map((m, i) => applyAttempt(prev[i], { ...m, date }));
    await db.attempts.bulkAdd(
      marks.map((m, i) => ({
        topicId: m.topicId,
        problemNo: m.problemNo,
        date,
        result: m.result,
        reason: m.result === 'wrong' ? m.reason : undefined,
        isReview: isReview || prev[i] !== undefined,
        createdAt: now + i,
      })),
    );
    await db.problemStates.bulkPut(next);
  });
}

/** Add the 5 default subjects once. Runs in a transaction so concurrent calls can't double-seed. */
export async function seedIfEmpty(db: ExamDB) {
  await db.transaction('rw', db.subjects, async () => {
    if ((await db.subjects.count()) === 0) await db.subjects.bulkAdd(DEFAULT_SUBJECTS.map((s) => ({ ...s })));
  });
}

export async function saveSettings(db: ExamDB, s: Settings) {
  await db.settings.put(s);
}

/** Replace a subject's topic list. Topics matched by name keep their id (and history). */
export async function replaceTopics(
  db: ExamDB,
  subjectId: number,
  items: { name: string; problemCount: number }[],
) {
  await db.transaction('rw', db.topics, db.attempts, db.problemStates, async () => {
    const existing = await db.topics.where('subjectId').equals(subjectId).toArray();
    const byName = new Map(existing.map((t) => [t.name, t]));
    const keepIds = new Set<number>();
    const rows: Topic[] = items.map((it, order) => {
      const old = byName.get(it.name);
      if (old) keepIds.add(old.id!);
      return old
        ? { ...old, order, problemCount: it.problemCount }
        : { subjectId, name: it.name, order, problemCount: it.problemCount, summaryRead: false };
    });
    const removed = existing.filter((t) => !keepIds.has(t.id!)).map((t) => t.id!);
    if (removed.length) {
      await db.topics.bulkDelete(removed);
      await db.attempts.where('topicId').anyOf(removed).delete();
      await db.problemStates.where('topicId').anyOf(removed).delete();
    }
    await db.topics.bulkPut(rows);
  });
}

export async function rebuildAllStates(db: ExamDB) {
  await db.transaction('rw', db.attempts, db.problemStates, async () => {
    const map = rebuildStates(await db.attempts.toArray());
    await db.problemStates.clear();
    await db.problemStates.bulkPut([...map.values()]);
  });
}
