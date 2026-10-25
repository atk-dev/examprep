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
}

export interface Subject {
  id?: number;
  name: string;
  color: string;
  order: number;
}

export interface Topic {
  id?: number;
  subjectId: number;
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
}
