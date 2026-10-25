import type { Settings, Subject } from '../types';
import { defaultPhases } from '../logic/plan';

export const DEFAULT_EXAM_DATE = '2027-03-27';

export const DEFAULT_SUBJECTS: Omit<Subject, 'id'>[] = [
  { name: 'คณิตศาสตร์', color: '#4f46e5', order: 0 },
  { name: 'วิทยาศาสตร์', color: '#059669', order: 1 },
  { name: 'ภาษาอังกฤษ', color: '#d97706', order: 2 },
  { name: 'สังคมศึกษา', color: '#db2777', order: 3 },
  { name: 'ภาษาไทย', color: '#0891b2', order: 4 },
];

export function defaultSettings(startDate: string, examDate = DEFAULT_EXAM_DATE): Settings {
  return {
    id: 'main',
    examName: 'สอบเข้า ม.1',
    examDate,
    startDate,
    ...defaultPhases(examDate),
    restWeekdays: [],
    parentPin: '',
    setupDone: false,
  };
}

/** Parse "ชื่อหัวข้อ, จำนวนข้อ" lines. Accepts comma, tab or 2+ spaces as separator. */
export function parseTopicLines(text: string): { name: string; problemCount: number }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)(?:\s*[,\t]\s*|\s{2,})(\d+)\s*(?:ข้อ)?$/);
      if (!m) return null;
      const name = m[1].trim();
      const problemCount = parseInt(m[2], 10);
      return name && problemCount > 0 ? { name, problemCount } : null;
    })
    .filter((x): x is { name: string; problemCount: number } => x !== null);
}
