import Dexie, { type Table } from 'dexie';
import type { Attempt, DailyLog, ProblemState, Settings, Subject, Topic } from '../types';

export class ExamDB extends Dexie {
  settings!: Table<Settings, string>;
  subjects!: Table<Subject, number>;
  topics!: Table<Topic, number>;
  attempts!: Table<Attempt, number>;
  problemStates!: Table<ProblemState, string>;
  dailyLogs!: Table<DailyLog, string>;

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
  }
}

export const db = new ExamDB();
