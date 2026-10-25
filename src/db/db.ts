import Dexie, { type Table } from 'dexie';
import type { Attempt, DailyLog, ProblemNote, ProblemState, Settings, Subject, Topic } from '../types';

export class ExamDB extends Dexie {
  settings!: Table<Settings, string>;
  subjects!: Table<Subject, number>;
  topics!: Table<Topic, number>;
  attempts!: Table<Attempt, number>;
  problemStates!: Table<ProblemState, string>;
  dailyLogs!: Table<DailyLog, string>;
  problemNotes!: Table<ProblemNote, string>;

  constructor(name = 'examprep') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      subjects: '++id, order',
      topics: '++id, subjectId, order',
      attempts: '++id, topicId, date, [topicId+problemNo]',
      problemStates: 'key, topicId, status, nextReview',
      dailyLogs: 'date',
    });
    this.version(2).stores({ problemNotes: 'key, topicId' });
  }
}

export const db = new ExamDB();
