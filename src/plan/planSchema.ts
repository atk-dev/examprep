import type { ISODate } from '../types';

export type SubjectKey = string;
export type TaskType =
  | 'practice' | 'timed' | 'reviewWrong' | 'subjectReview' | 'saturday' | 'mock' | 'catchup' | 'kickoff' | 'exam';

export interface PlanSet {
  id: string;
  subject: SubjectKey;
  kind: 'chapter' | 'pretest' | 'mock' | 'extra';
  name: string;
  count: number;
}

export interface PlanTask {
  id: string;
  date: ISODate;
  type: TaskType;
  subject?: SubjectKey;
  set?: string;
  from?: number;
  to?: number;
  minutes?: number | null;
  title: string;
  note?: string;
  mock?: number;
}

export interface PlanFile {
  format: 'examprep-plan';
  version: 1;
  title: string;
  description?: string;
  profile?: { school?: string; studentName?: string; teacherName?: string; targetScore?: number | null };
  exam: {
    name: string;
    date: ISODate;
    totalScore?: number;
    note?: string;
    sessions: { subject: SubjectKey; start?: string; minutes: number; questions: number }[];
  };
  subjects: { id: SubjectKey; name: string; color: string }[];
  phases: { id: string; name: string; start: ISODate; end: ISODate; goal?: string }[];
  restWeekdays: number[];
  sets: PlanSet[];
  tasks: PlanTask[];
  mocks: { n: number; date: ISODate; note?: string }[];
}

export const TASK_TYPES: TaskType[] = ['practice', 'timed', 'reviewWrong', 'subjectReview', 'saturday', 'mock', 'catchup', 'kickoff', 'exam'];

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate a plan file. Errors are Thai and point at the exact field. */
export function validatePlan(raw: unknown): { plan: PlanFile | null; errors: string[] } {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.length < 50 && errors.push(`${path}: ${msg}`);
  if (!isObj(raw)) return { plan: null, errors: ['ไฟล์ไม่ใช่ JSON object'] };
  if (raw.format !== 'examprep-plan') err('format', 'ต้องเป็น "examprep-plan"');
  if (raw.version !== 1) err('version', 'รองรับเฉพาะเวอร์ชัน 1');
  if (typeof raw.title !== 'string' || !raw.title) err('title', 'ต้องมีชื่อแผน');

  const exam = raw.exam;
  if (!isObj(exam)) err('exam', 'ต้องมีข้อมูลการสอบ');
  else {
    if (typeof exam.name !== 'string') err('exam.name', 'ต้องมีชื่อการสอบ');
    if (!isDate(exam.date)) err('exam.date', 'วันที่ต้องอยู่ในรูป YYYY-MM-DD');
    if (!Array.isArray(exam.sessions)) err('exam.sessions', 'ต้องเป็นรายการ');
  }

  const subjects = Array.isArray(raw.subjects) ? raw.subjects : [];
  if (!subjects.length) err('subjects', 'ต้องมีอย่างน้อย 1 วิชา');
  const subjectIds = new Set<string>();
  subjects.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string') return err(`subjects[${i}]`, 'ต้องมี id และ name');
    if (subjectIds.has(s.id)) err(`subjects[${i}].id`, `ซ้ำ "${s.id}"`);
    subjectIds.add(s.id);
  });
  if (isObj(exam) && Array.isArray(exam.sessions)) {
    exam.sessions.forEach((s, i) => {
      if (!isObj(s) || !subjectIds.has(s.subject as string)) err(`exam.sessions[${i}].subject`, `ไม่พบวิชา "${isObj(s) ? s.subject : ''}"`);
    });
  }

  const phases = Array.isArray(raw.phases) ? raw.phases : [];
  phases.forEach((p, i) => {
    if (!isObj(p) || !isDate(p.start) || !isDate(p.end)) return err(`phases[${i}]`, 'ต้องมี start และ end เป็นวันที่');
    if ((p.start as string) > (p.end as string)) err(`phases[${i}]`, 'วันเริ่มอยู่หลังวันจบ');
  });
  if (!Array.isArray(raw.restWeekdays) || raw.restWeekdays.some((d) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) {
    err('restWeekdays', 'ต้องเป็นรายการเลข 0–6 (0 = อาทิตย์)');
  }

  const sets = Array.isArray(raw.sets) ? raw.sets : [];
  const setCount = new Map<string, number>();
  sets.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string') return err(`sets[${i}]`, 'ต้องมี id');
    if (setCount.has(s.id)) err(`sets[${i}].id`, `ซ้ำ "${s.id}"`);
    if (!subjectIds.has(s.subject as string)) err(`sets[${i}].subject`, `ไม่พบวิชา "${s.subject}"`);
    if (!Number.isInteger(s.count) || (s.count as number) < 1) err(`sets[${i}].count`, 'ต้องเป็นจำนวนเต็มมากกว่า 0');
    if (typeof s.name !== 'string' || !s.name) err(`sets[${i}].name`, 'ต้องมีชื่อ');
    setCount.set(s.id, s.count as number);
  });

  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  if (!tasks.length) err('tasks', 'ต้องมีอย่างน้อย 1 งาน');
  const taskIds = new Set<string>();
  tasks.forEach((t, i) => {
    const p = `tasks[${i}]`;
    if (!isObj(t)) return err(p, 'ต้องเป็น object');
    if (typeof t.id !== 'string' || !t.id) err(`${p}.id`, 'ต้องมี id');
    else if (taskIds.has(t.id)) err(`${p}.id`, `ซ้ำ "${t.id}"`);
    else taskIds.add(t.id);
    if (!isDate(t.date)) err(`${p}.date`, 'วันที่ต้องอยู่ในรูป YYYY-MM-DD');
    if (!TASK_TYPES.includes(t.type as TaskType)) err(`${p}.type`, `ไม่รู้จักประเภท "${t.type}"`);
    if (t.subject !== undefined && !subjectIds.has(t.subject as string)) err(`${p}.subject`, `ไม่พบวิชา "${t.subject}"`);
    if (typeof t.title !== 'string' || !t.title) err(`${p}.title`, 'ต้องมีชื่องาน');
    if (t.set !== undefined) {
      const count = setCount.get(t.set as string);
      if (count === undefined) err(`${p}.set`, `ไม่พบชุด "${t.set}"`);
      else if (t.from !== undefined || t.to !== undefined) {
        const from = t.from as number;
        const to = t.to as number;
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > count) {
          err(`${p}.from/to`, `ช่วงข้อ ${t.from}–${t.to} ไม่อยู่ใน 1–${count}`);
        }
      }
    }
  });

  const mocks = Array.isArray(raw.mocks) ? raw.mocks : [];
  mocks.forEach((m, i) => {
    if (!isObj(m) || !Number.isInteger(m.n) || !isDate(m.date)) err(`mocks[${i}]`, 'ต้องมี n และ date');
  });

  return { plan: errors.length ? null : (raw as unknown as PlanFile), errors };
}
