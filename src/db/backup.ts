import { strToU8, unzipSync, zipSync } from 'fflate';
import type { ExamDB } from './db';
import { rebuildAllStates } from './actions';
import type { Figure } from '../types';

export const BACKUP_VERSION = 4;

/** Tables in a backup, in restore order. v1 had the first five; later versions add the rest. */
const REQUIRED = ['settings', 'subjects', 'topics', 'attempts', 'dailyLogs'] as const;
const OPTIONAL = ['problemNotes', 'mockSets', 'plan', 'taskDone', 'mockExams', 'questions', 'passages'] as const;
type TableName = (typeof REQUIRED)[number] | (typeof OPTIONAL)[number];

export interface Backup {
  app: 'examprep';
  version: number;
  exportedAt: string;
  data: Record<(typeof REQUIRED)[number], unknown[]> & Partial<Record<(typeof OPTIONAL)[number], unknown[]>>;
  /** v4: figures stored next to backup.json in the zip, under figures/<n>. */
  figures?: { id: string; mime: string; file: string }[];
}

export async function exportBackup(db: ExamDB): Promise<Backup> {
  const data = {} as Backup['data'];
  for (const name of [...REQUIRED, ...OPTIONAL] as TableName[]) {
    (data as Record<string, unknown[]>)[name] = await db.table(name).toArray();
  }
  return { app: 'examprep', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Full backup as a zip: backup.json plus figure files. */
export async function exportBackupZip(db: ExamDB): Promise<Uint8Array> {
  const b = await exportBackup(db);
  const figures = await db.figures.toArray();
  const files: Record<string, Uint8Array> = {};
  b.figures = figures.map((f, i) => {
    const file = `figures/${i}`;
    files[file] = new Uint8Array(f.data);
    return { id: f.id, mime: f.mime, file };
  });
  files['backup.json'] = strToU8(JSON.stringify(b));
  return zipSync(files, { level: 6 });
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
  for (const k of REQUIRED) {
    if (!Array.isArray(b.data[k])) throw new Error(`ข้อมูล ${k} ไม่ถูกต้อง`);
  }
  for (const k of OPTIONAL) {
    if (b.data[k] !== undefined && !Array.isArray(b.data[k])) throw new Error(`ข้อมูล ${k} ไม่ถูกต้อง`);
  }
  return b;
}

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

/** Read a backup file: a v4 zip (with figures) or a v1–v3 JSON file. */
export function readBackupFile(bytes: Uint8Array): { backup: Backup; figures: Figure[] } {
  if (!isZip(bytes)) return { backup: parseBackup(new TextDecoder().decode(bytes)), figures: [] };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('เปิดไฟล์ zip ไม่ได้');
  }
  if (!files['backup.json']) throw new Error('ไม่พบ backup.json ใน zip');
  const backup = parseBackup(new TextDecoder().decode(files['backup.json']));
  const figures: Figure[] = (backup.figures ?? [])
    .filter((f) => files[f.file])
    .map((f) => ({ id: f.id, mime: f.mime, data: files[f.file].slice().buffer as ArrayBuffer }));
  return { backup, figures };
}

/** Replace everything with the backup. Review states are rebuilt from attempts. */
export async function importBackup(db: ExamDB, b: Backup, figures: Figure[] = []) {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    for (const name of [...REQUIRED, ...OPTIONAL] as TableName[]) {
      const rows = (b.data as Record<string, unknown[] | undefined>)[name];
      if (rows?.length) await db.table(name).bulkPut(rows);
    }
    if (figures.length) await db.figures.bulkPut(figures);
  });
  await rebuildAllStates(db);
}
