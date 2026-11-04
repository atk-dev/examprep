/** Local calendar date, format yyyy-MM-dd. */
export type ISODate = string;

export interface Settings {
  id: 'main';
  examName: string;
  examDate: ISODate;
  startDate: ISODate;
  /** Last day of each phase (inclusive). Final week runs phase3End+1 .. examDate-1. */
  phase1End: ISODate;
  phase2End: ISODate;
  phase3End: ISODate;
  /** 0 = Sunday ... 6 = Saturday. */
  restWeekdays: number[];
  parentPin: string;
  setupDone: boolean;
  /** Minutes per problem in timed sets. */
  mockMinutesPerProblem?: number;
  /** Daily reminder time, HH:mm. */
  reminderTime?: string;
  /** Last time a backup was exported (ms). */
  lastBackupAt?: number;
  /** 'plan' = an imported study plan drives Today; 'auto' (default) = daily quota. */
  planMode?: 'auto' | 'plan';
  /** Phase names/goals from an imported plan (replaces the built-in labels). */
  phaseLabels?: { name: string; goal?: string }[];
  profile?: Profile;
}

export interface Profile {
  studentName?: string;
  teacherName?: string;
  school?: string;
  /** Target total score in the real exam (e.g. out of 200). */
  targetScore?: number | null;
}

export interface Subject {
  id?: number;
  /** Stable id from an imported plan/bank (math, thai, science, english, social). */
  key?: string;
  name: string;
  color: string;
  order: number;
}

export interface Topic {
  id?: number;
  subjectId: number;
  /** Stable set id from an imported plan/bank (e.g. prep-math-04, pretest-math-1). */
  key?: string;
  kind?: 'chapter' | 'pretest' | 'mock' | 'extra';
  name: string;
  order: number;
  problemCount: number;
  summaryRead: boolean;
}

export type MistakeReason = 'concept' | 'careless' | 'time' | 'misread';
export type Result = 'correct' | 'wrong';

export interface Attempt {
  id?: number;
  topicId: number;
  problemNo: number;
  date: ISODate;
  result: Result;
  reason?: MistakeReason;
  isReview: boolean;
  createdAt: number;
}

/**
 * done      = correct on first try, no review needed
 * wrong     = got it wrong, waiting for first review
 * reviewing = passed at least one review, more to go
 * mastered  = passed all reviews
 */
export type ProblemStatus = 'done' | 'wrong' | 'reviewing' | 'mastered';

export interface ProblemState {
  key: string; // `${topicId}:${problemNo}`
  topicId: number;
  problemNo: number;
  status: ProblemStatus;
  box: number;
  nextReview: ISODate | null;
  firstDate: ISODate;
  lastDate: ISODate;
  firstResult: Result;
  attempts: number;
  wrongCount: number;
  lastReason?: MistakeReason;
}

export interface DailyLog {
  date: ISODate;
  minutes: number;
  note?: string;
}

/** Student's own note on a problem (e.g. the key idea from the solution). Kept apart from derived state. */
export interface ProblemNote {
  key: string; // `${topicId}:${problemNo}`
  topicId: number;
  text: string;
  updatedAt: number;
  /** Flagged to ask the teacher on Saturday. */
  askTeacher?: boolean;
}

export interface MockItem {
  subjectId: number;
  topicId: number;
  problemNo: number;
}

export interface MockResult {
  result: Result;
  reason?: MistakeReason;
}

/** A timed mixed-subject practice set. */
export interface MockSet {
  id?: number;
  date: ISODate;
  status: 'active' | 'done';
  startedAt: number;
  limitSec: number;
  /** When the student stopped the clock (finished or time ran out). */
  stoppedAt?: number;
  items: MockItem[];
  results?: MockResult[];
}

/** A plan task marked done by hand (tasks with a problem range also complete automatically). */
export interface TaskDone {
  taskId: string;
  doneAt: number;
}

/** One of the plan's mock exams (สอบจำลอง): score per subject key. */
export interface MockExam {
  n: number;
  date: ISODate;
  scores: Record<string, number | null>;
  minutes?: number | null;
  focus?: string;
  /** Guided timer start (ms), if the student used it. */
  timerStartedAt?: number;
}

/** A question from an imported bank. Linked to a topic through `setKey` = Topic.key. */
export interface Question {
  key: string; // `${setKey}:${no}`
  setKey: string;
  no: number;
  type: 'choice' | 'short' | 'open';
  text: string;
  choices?: string[];
  answer: number | string | null;
  solution?: string;
  topic?: string;
  passageId?: string;
  image?: string;
  needsReview?: boolean;
  reviewNote?: string;
}

export interface Passage {
  id: string;
  text: string;
  image?: string;
}

/** Image bytes from a question bank (kept as ArrayBuffer; shown through an object URL). */
export interface Figure {
  id: string; // path inside the bank zip, e.g. figures/prep-math-04-012.png
  mime: string;
  data: ArrayBuffer;
}

export interface PlanMeta {
  id: 'main';
  importedAt: number;
  plan: import('./plan/planSchema').PlanFile;
}
