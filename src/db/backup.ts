import type { ExamDB } from './db';
import { rebuildAllStates } from './actions';

export const BACKUP_VERSION = 3;

export interface Backup {
  app: 'examprep';
  version: number;
  exportedAt: string;
  data: {
    settings: unknown[];
    subjects: unknown[];
    topics: unknown[];
    attempts: unknown[];
    dailyLogs: unknown[];
    problemNotes?: unknown[]; // added in v2
    mockSets?: unknown[]; // added in v3
  };
}

export async function exportBackup(db: ExamDB): Promise<Backup> {
  return {
    app: 'examprep',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: await db.settings.toArray(),
      subjects: await db.subjects.toArray(),
      topics: await db.topics.toArray(),
      attempts: await db.attempts.toArray(),
      dailyLogs: await db.dailyLogs.toArray(),
      problemNotes: await db.problemNotes.toArray(),
      mockSets: await db.mockSets.toArray(),
    },
  };
}

export function parseBackup(json: string): Backup {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error('ไฟล์ไม่ใช่ JSON');
  }
  const b = obj as Backup;
  if (!b || b.app !== 'examprep' || typeof b.version !== 'number' || !b.data) {
    throw new Error('ไม่ใช่ไฟล์สำรองข้อมูลของแอปนี้');
  }
  if (b.version > BACKUP_VERSION) throw new Error('ไฟล์มาจากแอปเวอร์ชันใหม่กว่า');
  for (const k of ['settings', 'subjects', 'topics', 'attempts', 'dailyLogs'] as const) {
    if (!Array.isArray(b.data[k])) throw new Error(`ข้อมูล ${k} ไม่ถูกต้อง`);
  }
  for (const k of ['problemNotes', 'mockSets'] as const) {
    if (b.data[k] !== undefined && !Array.isArray(b.data[k])) throw new Error(`ข้อมูล ${k} ไม่ถูกต้อง`);
  }
  return b;
}

/** Replace everything with the backup. Review states are rebuilt from attempts. */
export async function importBackup(db: ExamDB, b: Backup) {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.bulkPut(b.data.settings as never[]);
    await db.subjects.bulkPut(b.data.subjects as never[]);
    await db.topics.bulkPut(b.data.topics as never[]);
    await db.attempts.bulkPut(b.data.attempts as never[]);
    await db.dailyLogs.bulkPut(b.data.dailyLogs as never[]);
    await db.problemNotes.bulkPut((b.data.problemNotes ?? []) as never[]);
    await db.mockSets.bulkPut((b.data.mockSets ?? []) as never[]);
  });
  await rebuildAllStates(db);
}
