import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ExamDB } from './db';
import { replaceTopics, saveMarks, seedIfEmpty } from './actions';
import { exportBackup, importBackup, parseBackup } from './backup';
import { defaultSettings, parseTopicLines } from './defaults';

describe('db', () => {
  it('parses topic lines', () => {
    expect(parseTopicLines('เศษส่วน, 40\nทศนิยม\t30\n  \nร้อยละ  25 ข้อ\nbad line')).toEqual([
      { name: 'เศษส่วน', problemCount: 40 },
      { name: 'ทศนิยม', problemCount: 30 },
      { name: 'ร้อยละ', problemCount: 25 },
    ]);
  });

  it('saves marks, keeps history on topic rename-safe edits, and round-trips a backup', async () => {
    const db = new ExamDB('t1');
    await Promise.all([seedIfEmpty(db), seedIfEmpty(db)]);
    expect(await db.subjects.count()).toBe(5);
    await db.settings.put(defaultSettings('2026-10-25'));
    const math = (await db.subjects.orderBy('order').first())!;
    await replaceTopics(db, math.id!, [{ name: 'เศษส่วน', problemCount: 10 }, { name: 'ทศนิยม', problemCount: 5 }]);
    const [t1] = await db.topics.where('subjectId').equals(math.id!).sortBy('order');

    await saveMarks(db, [
      { topicId: t1.id!, problemNo: 1, result: 'correct' },
      { topicId: t1.id!, problemNo: 2, result: 'wrong', reason: 'time' },
    ], '2026-10-25', false);
    expect(await db.problemStates.count()).toBe(2);
    expect((await db.problemStates.get(`${t1.id}:2`))?.nextReview).toBe('2026-10-26');

    // Editing counts keeps the topic id and its history; removing a topic deletes its data.
    await replaceTopics(db, math.id!, [{ name: 'เศษส่วน', problemCount: 12 }]);
    expect((await db.topics.get(t1.id!))?.problemCount).toBe(12);
    expect(await db.topics.where('subjectId').equals(math.id!).count()).toBe(1);
    expect(await db.attempts.count()).toBe(2);

    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    const db2 = new ExamDB('t2');
    await importBackup(db2, backup);
    expect(await db2.attempts.count()).toBe(2);
    expect(await db2.subjects.count()).toBe(5);
    expect((await db2.problemStates.get(`${t1.id}:2`))?.status).toBe('wrong');
  });

  it('rejects bad backups', () => {
    expect(() => parseBackup('nope')).toThrow();
    expect(() => parseBackup('{"app":"other"}')).toThrow();
  });
});
