import Dexie, { type Table } from 'dexie';
import type {
  Attempt, DailyLog, Figure, MockExam, MockSet, Passage, PlanMeta, ProblemNote, ProblemState, Question, Settings, Subject, TaskDone, Topic,
} from '../types';

export class ExamDB extends Dexie {
  settings!: Table<Settings, string>;
  subjects!: Table<Subject, number>;
  topics!: Table<Topic, number>;
  attempts!: Table<Attempt, number>;
  problemStates!: Table<ProblemState, string>;
  dailyLogs!: Table<DailyLog, string>;
  problemNotes!: Table<ProblemNote, string>;
  mockSets!: Table<MockSet, number>;
  plan!: Table<PlanMeta, string>;
  taskDone!: Table<TaskDone, string>;
  mockExams!: Table<MockExam, number>;
  questions!: Table<Question, string>;
  passages!: Table<Passage, string>;
  figures!: Table<Figure, string>;

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
    this.version(3).stores({ mockSets: '++id, status, date' });
    this.version(4).stores({
      topics: '++id, subjectId, order, key',
      subjects: '++id, order, key',
      plan: 'id',
      taskDone: 'taskId',
      mockExams: 'n',
      questions: 'key, setKey',
      passages: 'id',
      figures: 'id',
    });
  }
}

export const db = new ExamDB();
