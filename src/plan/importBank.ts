import { unzipSync, type Unzipped } from 'fflate';
import type { ExamDB } from '../db/db';
import type { Figure, Passage, Question, Topic } from '../types';
import { choiceImage, validateBank, type BankFile } from './bankSchema';

const MAX_BYTES = 300 * 1024 * 1024;
const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm',
};
export const mimeOf = (path: string) => MIME[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';

/** Default subject names, used to find a subject when it has no key yet. */
const SUBJECT_NAMES: Record<string, string> = {
  math: 'คณิตศาสตร์', thai: 'ภาษาไทย', science: 'วิทยาศาสตร์', english: 'ภาษาอังกฤษ', social: 'สังคมศึกษา',
};
const SUBJECT_COLORS: Record<string, string> = {
  math: '#4f46e5', thai: '#0891b2', science: '#059669', english: '#d97706', social: '#db2777',
};

/**
 * Colors for subjects beyond the built-in five, validated with them as one categorical
 * palette (colour-blind separation + lightness). More subjects repeat these; every
 * subject is always shown with its name, so colour is never the only cue.
 */
const EXTRA_COLORS = ['#7c3aed', '#65a30d', '#b45309'];

export interface BankRead {
  bank: BankFile | null;
  errors: string[];
  files: Unzipped;
  summary: {
    exams: number;
    questions: number;
    withAnswer: number;
    figures: number;
    audio: number;
    passages: number;
    needsReview: number;
    bySubject: Record<string, number>;
  } | null;
}

function unzip(bytes: Uint8Array): Unzipped {
  let total = 0;
  return unzipSync(bytes, {
    filter: (f) => {
      if (f.name.endsWith('/') || f.name.includes('..') || f.name.startsWith('/')) return false;
      total += f.originalSize;
      if (total > MAX_BYTES) throw new Error('ไฟล์ใหญ่เกินไป (เกิน 300 MB เมื่อแตกไฟล์)');
      return true;
    },
  });
}

/** Every image/audio file a bank refers to. */
export function assetPaths(bank: BankFile): string[] {
  const out = new Set<string>();
  const add = (p?: string | null) => p && out.add(p);
  for (const q of bank.questions) {
    add(q.image);
    add(q.audio);
    for (const c of q.choices ?? []) add(choiceImage(c));
  }
  for (const p of bank.passages ?? []) {
    add(p.image);
    add(p.audio);
  }
  return [...out];
}

/** Unzip and validate a bank without touching the database (for the preview). */
export function readBank(bytes: Uint8Array): BankRead {
  let files: Unzipped;
  try {
    files = unzip(bytes);
  } catch (e) {
    return { bank: null, errors: [`เปิดไฟล์ zip ไม่ได้: ${(e as Error).message}`], files: {}, summary: null };
  }
  // The JSON may sit at the root or inside one top-level folder; figure paths are relative to it.
  const jsonPath = Object.keys(files).find((p) => p.split('/').pop() === 'examprep-questions.json');
  if (!jsonPath) return { bank: null, errors: ['ไม่พบไฟล์ examprep-questions.json ใน zip'], files, summary: null };
  const base = jsonPath.slice(0, jsonPath.length - 'examprep-questions.json'.length);
  const rel: Unzipped = {};
  for (const [p, data] of Object.entries(files)) if (p.startsWith(base)) rel[p.slice(base.length)] = data;

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(rel['examprep-questions.json']));
  } catch {
    return { bank: null, errors: ['examprep-questions.json ไม่ใช่ JSON ที่ถูกต้อง'], files: rel, summary: null };
  }
  const { bank, errors } = validateBank(raw, new Set(Object.keys(rel)));
  if (!bank) return { bank, errors, files: rel, summary: null };
  const bySubject: Record<string, number> = {};
  for (const q of bank.questions) bySubject[q.subject] = (bySubject[q.subject] ?? 0) + 1;
  const assets = assetPaths(bank);
  return {
    bank,
    errors,
    files: rel,
    summary: {
      exams: bank.exams.length,
      questions: bank.questions.length,
      withAnswer: bank.questions.filter((q) => q.answer !== null && q.answer !== '').length,
      figures: assets.filter((p) => mimeOf(p).startsWith('image/')).length,
      audio: assets.filter((p) => mimeOf(p).startsWith('audio/')).length,
      passages: bank.passages?.length ?? 0,
      needsReview: bank.questions.filter((q) => q.needsReview).length,
      bySubject,
    },
  };
}

export type ImageProcessor = (bytes: Uint8Array, mime: string) => Promise<{ data: ArrayBuffer; mime: string }>;

const copy = (b: Uint8Array) => b.slice().buffer as ArrayBuffer;
export const keepImage: ImageProcessor = async (bytes, mime) => ({ data: copy(bytes), mime });

/** Browser: shrink raster figures to ≤1000px WebP (keeps the original if that isn't smaller). */
export const shrinkImage: ImageProcessor = async (bytes, mime) => {
  if (!mime.startsWith('image/') || mime === 'image/svg+xml' || mime === 'image/gif' || typeof createImageBitmap !== 'function') return keepImage(bytes, mime);
  try {
    const bmp = await createImageBitmap(new Blob([copy(bytes)], { type: mime }));
    const scale = Math.min(1, 1000 / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
    if (blob && blob.type === 'image/webp' && blob.size < bytes.byteLength) return { data: await blob.arrayBuffer(), mime: 'image/webp' };
  } catch {
    /* fall through: keep original */
  }
  return keepImage(bytes, mime);
};

const sourceLine = (book?: string, page?: number | string) =>
  book || page ? [book, page !== undefined && page !== '' ? `หน้า ${page}` : ''].filter(Boolean).join(' · ') : undefined;

/** "ข้อสอบวิชาคณิตศาสตร์ บทที่ 1 …" → "บทที่ 1 …" for topic names. */
export const shortExamTitle = (title: string) => title.replace(/^ข้อสอบ(?:วิชา)?\S*\s+/, '').trim() || title;

/**
 * Store a validated bank: replaces any previous bank. Questions attach to topics whose
 * key equals the bank exam id; exams with no matching topic become extra practice topics.
 */
export async function applyBank(db: ExamDB, read: BankRead, processImage: ImageProcessor = keepImage, onProgress?: (done: number, total: number) => void) {
  const bank = read.bank!;
  const paths = assetPaths(bank);
  const defaultFormat = bank.textFormat ?? 'plain';
  const examById = new Map(bank.exams.map((e) => [e.id, e]));
  const figures: Figure[] = [];
  for (const [i, path] of paths.entries()) {
    const out = await processImage(read.files[path], mimeOf(path));
    figures.push({ id: path, mime: out.mime, data: out.data });
    onProgress?.(i + 1, paths.length);
  }
  const passages: Passage[] = (bank.passages ?? []).map((p) => ({
    id: p.id, text: p.text, image: p.image || undefined, audio: p.audio || undefined, format: p.format ?? defaultFormat,
  }));
  const questions: Question[] = bank.questions.map((q) => ({
    key: `${q.exam}:${q.no}`,
    setKey: q.exam,
    no: q.no,
    type: q.type,
    text: q.text,
    choices: q.choices,
    answer: q.answer,
    solution: q.solution || undefined,
    topic: q.topic || undefined,
    passageId: q.passage || undefined,
    image: q.image || undefined,
    needsReview: q.needsReview || undefined,
    reviewNote: q.reviewNote || undefined,
    format: q.format ?? defaultFormat,
    points: q.points,
    tags: q.tags?.length ? q.tags : undefined,
    audio: q.audio || undefined,
    source: sourceLine(examById.get(q.exam)?.source?.book, q.page),
  }));

  await db.transaction('rw', [db.questions, db.passages, db.figures, db.topics, db.subjects], async () => {
    await Promise.all([db.questions.clear(), db.passages.clear(), db.figures.clear()]);
    await db.figures.bulkPut(figures);
    await db.passages.bulkPut(passages);
    await db.questions.bulkPut(questions);

    const topics = await db.topics.toArray();
    const subjects = await db.subjects.toArray();
    const named = new Map((bank.subjects ?? []).map((x) => [x.id, x]));
    const subjectFor = async (key: string) => {
      const label = named.get(key)?.name ?? SUBJECT_NAMES[key];
      let s = subjects.find((x) => x.key === key) ?? subjects.find((x) => x.name === label);
      if (s && !s.key) {
        s.key = key;
        await db.subjects.update(s.id!, { key });
      }
      if (!s) {
        s = { key, name: label ?? key, color: named.get(key)?.color ?? SUBJECT_COLORS[key] ?? EXTRA_COLORS[subjects.length % EXTRA_COLORS.length], order: subjects.length };
        s.id = await db.subjects.add(s);
        subjects.push(s);
      }
      return s;
    };
    let order = topics.reduce((m, t) => Math.max(m, t.order), -1) + 1;
    for (const exam of bank.exams) {
      const qs = bank.questions.filter((q) => q.exam === exam.id);
      if (!qs.length) continue;
      const maxNo = Math.max(...qs.map((q) => q.no));
      const existing = topics.find((t) => t.key === exam.id);
      if (existing) {
        if (existing.problemCount < maxNo) await db.topics.update(existing.id!, { problemCount: maxNo });
        continue;
      }
      const subject = await subjectFor(qs[0].subject);
      const row: Topic = { subjectId: subject.id!, key: exam.id, kind: 'extra', name: shortExamTitle(exam.title), order: order++, problemCount: maxNo, summaryRead: false };
      await db.topics.add(row);
    }
  });
  return { questions: questions.length, figures: figures.length };
}
