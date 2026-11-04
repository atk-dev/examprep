export type BankSubject = 'math' | 'thai' | 'science' | 'english' | 'social';

export interface BankExam {
  id: string;
  title: string;
  school?: string;
  year?: number | null;
  file?: string;
  sessions?: { subject: string; minutes: number; questions: number }[];
}
export interface BankPassage {
  id: string;
  exam: string;
  subject: string;
  text: string;
  image?: string;
}
export interface BankQuestion {
  id: string;
  exam: string;
  subject: BankSubject;
  no: number;
  type: 'choice' | 'short' | 'open';
  passage?: string | null;
  text: string;
  choices?: string[];
  answer: number | string | null;
  solution?: string;
  topic?: string;
  image?: string;
  needsReview?: boolean;
  reviewNote?: string;
}
export interface BankFile {
  format: 'examprep-questions';
  version: 1;
  exams: BankExam[];
  passages?: BankPassage[];
  questions: BankQuestion[];
}

const SUBJECTS = new Set(['math', 'thai', 'science', 'english', 'social']);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate a question bank. `files` is the set of paths present in the zip, used to
 * check that every `image` exists. Errors are Thai and point at the question id.
 */
export function validateBank(raw: unknown, files: Set<string>): { bank: BankFile | null; errors: string[] } {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.length < 50 && errors.push(`${path}: ${msg}`);
  if (!isObj(raw)) return { bank: null, errors: ['ไฟล์ไม่ใช่ JSON object'] };
  if (raw.format !== 'examprep-questions') err('format', 'ต้องเป็น "examprep-questions"');
  if (raw.version !== 1) err('version', 'รองรับเฉพาะเวอร์ชัน 1');

  const exams = Array.isArray(raw.exams) ? raw.exams : [];
  if (!exams.length) err('exams', 'ต้องมีอย่างน้อย 1 ชุด');
  const examIds = new Set<string>();
  exams.forEach((e, i) => {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.title !== 'string') return err(`exams[${i}]`, 'ต้องมี id และ title');
    if (examIds.has(e.id)) err(`exams[${i}].id`, `ซ้ำ "${e.id}"`);
    examIds.add(e.id);
  });

  const passages = Array.isArray(raw.passages) ? raw.passages : [];
  const passageIds = new Set<string>();
  passages.forEach((p, i) => {
    if (!isObj(p) || typeof p.id !== 'string') return err(`passages[${i}]`, 'ต้องมี id');
    const at = `passage ${p.id}`;
    if (passageIds.has(p.id)) err(at, 'id ซ้ำ');
    passageIds.add(p.id);
    if (!examIds.has(p.exam as string)) err(at, `ไม่พบชุด "${p.exam}"`);
    if (p.image !== undefined && p.image !== null && !files.has(p.image as string)) err(at, `ไม่พบไฟล์รูป "${p.image}"`);
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
    if (!SUBJECTS.has(q.subject as string)) err(at, `วิชา "${q.subject}" ไม่ถูกต้อง`);
    if (!Number.isInteger(q.no) || (q.no as number) < 1) err(at, 'no ต้องเป็นเลขข้อ 1 ขึ้นไป');
    const key = `${q.exam}:${q.no}`;
    if (examNo.has(key)) err(at, `เลขข้อ ${q.no} ซ้ำในชุด ${q.exam}`);
    examNo.add(key);
    if (typeof q.text !== 'string') err(at, 'ต้องมีโจทย์ (text)');
    if (q.passage && !passageIds.has(q.passage as string)) err(at, `ไม่พบบทอ่าน "${q.passage}"`);
    if (q.image !== undefined && q.image !== null && !files.has(q.image as string)) err(at, `ไม่พบไฟล์รูป "${q.image}"`);
    if (q.type === 'choice') {
      const n = Array.isArray(q.choices) ? q.choices.length : 0;
      if (n < 2) err(at, 'ข้อปรนัยต้องมีตัวเลือกอย่างน้อย 2 ตัว');
      if (q.answer !== null && (!Number.isInteger(q.answer) || (q.answer as number) < 1 || (q.answer as number) > n)) {
        err(at, `คำตอบ ${q.answer} ไม่อยู่ในตัวเลือก 1–${n}`);
      }
    } else if (q.type !== 'short' && q.type !== 'open') err(at, `ไม่รู้จักประเภท "${q.type}"`);
  });

  return { bank: errors.length ? null : (raw as unknown as BankFile), errors };
}
