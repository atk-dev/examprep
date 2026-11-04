/**
 * Question bank format `examprep-questions`, version 1 or 1.1.
 * 1.1 only adds optional fields, so every version-1 file is still valid.
 */
export type QuestionType = 'choice' | 'multi' | 'short' | 'open';
export type TextFormat = 'plain' | 'rich';

/** A choice is plain text, or text and/or a picture (1.1). */
export type BankChoice = string | { text?: string; image?: string };

export interface BankSource {
  book?: string;
  publisher?: string;
  url?: string;
  license?: string;
}

export interface BankExam {
  id: string;
  title: string;
  school?: string;
  year?: number | null;
  file?: string;
  sessions?: { subject: string; minutes: number; questions: number }[];
  /** 1.1: where the questions come from. */
  source?: BankSource;
  language?: string;
}
export interface BankPassage {
  id: string;
  exam: string;
  subject: string;
  text: string;
  image?: string;
  audio?: string;
  format?: TextFormat;
}
export interface BankQuestion {
  id: string;
  exam: string;
  /** Any subject id (1.1); the five built-in ones get Thai names and colors automatically. */
  subject: string;
  no: number;
  type: QuestionType;
  passage?: string | null;
  text: string;
  choices?: BankChoice[];
  /** choice: 1-based index · multi: list of indexes · short: text · null: unknown (self-graded). */
  answer: number | number[] | string | null;
  solution?: string;
  topic?: string;
  image?: string;
  needsReview?: boolean;
  reviewNote?: string;
  /** 1.1 additions */
  points?: number;
  tags?: string[];
  page?: number | string;
  audio?: string;
  format?: TextFormat;
}
export interface BankFile {
  format: 'examprep-questions';
  version: 1 | 1.1;
  /** 1.1: display names/colors for subject ids. */
  subjects?: { id: string; name: string; color?: string }[];
  /** 1.1: default text format for every question/passage (default "plain"). */
  textFormat?: TextFormat;
  exams: BankExam[];
  passages?: BankPassage[];
  questions: BankQuestion[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const TYPES = new Set(['choice', 'multi', 'short', 'open']);
const FORMATS = new Set(['plain', 'rich']);
const SUBJECT_ID = /^[a-z0-9][a-z0-9_-]*$/i;

export const choiceText = (c: BankChoice) => (typeof c === 'string' ? c : c.text ?? '');
export const choiceImage = (c: BankChoice) => (typeof c === 'string' ? undefined : c.image);

/**
 * Validate a question bank. `files` is the set of paths present in the zip, used to
 * check that every image/audio file exists. Errors are Thai and point at the question id.
 */
export function validateBank(raw: unknown, files: Set<string>): { bank: BankFile | null; errors: string[] } {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.length < 50 && errors.push(`${path}: ${msg}`);
  const file = (at: string, kind: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return;
    if (typeof v !== 'string' || !files.has(v)) err(at, `ไม่พบไฟล์${kind} "${v}"`);
  };
  if (!isObj(raw)) return { bank: null, errors: ['ไฟล์ไม่ใช่ JSON object'] };
  if (raw.format !== 'examprep-questions') err('format', 'ต้องเป็น "examprep-questions"');
  if (raw.version !== 1 && raw.version !== 1.1) err('version', 'รองรับเวอร์ชัน 1 และ 1.1');
  if (raw.textFormat !== undefined && !FORMATS.has(raw.textFormat as string)) err('textFormat', 'ต้องเป็น "plain" หรือ "rich"');
  if (raw.subjects !== undefined) {
    if (!Array.isArray(raw.subjects)) err('subjects', 'ต้องเป็นรายการ');
    else raw.subjects.forEach((s, i) => {
      if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string') err(`subjects[${i}]`, 'ต้องมี id และ name');
    });
  }

  const exams = Array.isArray(raw.exams) ? raw.exams : [];
  if (!exams.length) err('exams', 'ต้องมีอย่างน้อย 1 ชุด');
  const examIds = new Set<string>();
  exams.forEach((e, i) => {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.title !== 'string') return err(`exams[${i}]`, 'ต้องมี id และ title');
    if (examIds.has(e.id)) err(`exams[${i}].id`, `ซ้ำ "${e.id}"`);
    examIds.add(e.id);
    if (e.source !== undefined && !isObj(e.source)) err(`exams[${i}].source`, 'ต้องเป็น object');
  });

  const passages = Array.isArray(raw.passages) ? raw.passages : [];
  const passageIds = new Set<string>();
  passages.forEach((p, i) => {
    if (!isObj(p) || typeof p.id !== 'string') return err(`passages[${i}]`, 'ต้องมี id');
    const at = `passage ${p.id}`;
    if (passageIds.has(p.id)) err(at, 'id ซ้ำ');
    passageIds.add(p.id);
    if (!examIds.has(p.exam as string)) err(at, `ไม่พบชุด "${p.exam}"`);
    file(at, 'รูป', p.image);
    file(at, 'เสียง', p.audio);
  });

  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  if (!questions.length) err('questions', 'ต้องมีอย่างน้อย 1 ข้อ');
  const qIds = new Set<string>();
  const examNo = new Set<string>();
  questions.forEach((q, i) => {
    if (!isObj(q) || typeof q.id !== 'string') return err(`questions[${i}]`, 'ต้องมี id');
    const at = `ข้อ ${q.id}`;
    if (qIds.has(q.id)) err(at, 'id ซ้ำ');
    qIds.add(q.id);
    if (!examIds.has(q.exam as string)) err(at, `ไม่พบชุด "${q.exam}"`);
    if (typeof q.subject !== 'string' || !SUBJECT_ID.test(q.subject)) err(at, `วิชา "${q.subject}" ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข เช่น math, chemistry`);
    if (!Number.isInteger(q.no) || (q.no as number) < 1) err(at, 'no ต้องเป็นเลขข้อ 1 ขึ้นไป');
    const key = `${q.exam}:${q.no}`;
    if (examNo.has(key)) err(at, `เลขข้อ ${q.no} ซ้ำในชุด ${q.exam}`);
    examNo.add(key);
    if (typeof q.text !== 'string') err(at, 'ต้องมีโจทย์ (text)');
    if (q.passage && !passageIds.has(q.passage as string)) err(at, `ไม่พบบทอ่าน "${q.passage}"`);
    if (q.format !== undefined && !FORMATS.has(q.format as string)) err(at, 'format ต้องเป็น "plain" หรือ "rich"');
    if (q.points !== undefined && (typeof q.points !== 'number' || q.points < 0)) err(at, 'points ต้องเป็นตัวเลข 0 ขึ้นไป');
    if (q.tags !== undefined && (!Array.isArray(q.tags) || q.tags.some((t) => typeof t !== 'string'))) err(at, 'tags ต้องเป็นรายการข้อความ');
    file(at, 'รูป', q.image);
    file(at, 'เสียง', q.audio);
    if (!TYPES.has(q.type as string)) return err(at, `ไม่รู้จักประเภท "${q.type}"`);
    if (q.type === 'choice' || q.type === 'multi') {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const n = choices.length;
      if (n < 2) err(at, 'ข้อปรนัยต้องมีตัวเลือกอย่างน้อย 2 ตัว');
      choices.forEach((c, j) => {
        if (typeof c === 'string') return;
        if (!isObj(c) || (typeof c.text !== 'string' && typeof c.image !== 'string')) return err(at, `ตัวเลือกที่ ${j + 1} ต้องเป็นข้อความ หรือ { text, image }`);
        file(`${at} ตัวเลือกที่ ${j + 1}`, 'รูป', c.image);
      });
      const inRange = (a: unknown) => Number.isInteger(a) && (a as number) >= 1 && (a as number) <= n;
      if (q.answer !== null) {
        if (q.type === 'choice' && !inRange(q.answer)) err(at, `คำตอบ ${q.answer} ไม่อยู่ในตัวเลือก 1–${n}`);
        if (q.type === 'multi' && (!Array.isArray(q.answer) || !q.answer.length || !q.answer.every(inRange))) {
          err(at, `คำตอบต้องเป็นรายการเลขตัวเลือก 1–${n} เช่น [1, 3]`);
        }
      }
    }
  });

  return { bank: errors.length ? null : (raw as unknown as BankFile), errors };
}
