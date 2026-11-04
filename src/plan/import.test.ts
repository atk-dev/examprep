import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ExamDB } from '../db/db';
import { saveMarks } from '../db/actions';
import { exportBackupZip, importBackup, readBackupFile } from '../db/backup';
import planJson from '../../public/plans/teacher-m1-2570.json';
import type { PlanFile } from './planSchema';
import { applyPlan } from './importPlan';
import { applyBank, readBank, shortExamTitle } from './importBank';
import { overdue, planCurve, taskGap, taskStatus, type TaskCtx } from './progress';
import { rebuildStates } from '../logic/review';

const plan = planJson as unknown as PlanFile;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

// Invented questions only (the real bank is copyrighted and never committed).
function fixtureBank(over: (b: Record<string, unknown>) => void = () => {}) {
  const bank = {
    format: 'examprep-questions',
    version: 1,
    exams: [
      { id: 'prep-math-01', title: 'ข้อสอบวิชาคณิตศาสตร์ บทที่ 1 ตัวอย่าง', school: '', year: null, file: 'x.pdf', sessions: [] },
      { id: 'extra-sci-1', title: 'ข้อสอบวิชาวิทยาศาสตร์ ชุดเสริม', school: '', year: null, file: 'y.pdf', sessions: [] },
    ],
    passages: [{ id: 'p1', exam: 'prep-math-01', subject: 'math', text: 'ตารางตัวอย่าง', image: 'figures/p1.png' }],
    questions: [
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `m-${i + 1}`, exam: 'prep-math-01', subject: 'math', no: i + 1, type: 'choice', passage: i < 2 ? 'p1' : null,
        text: `${i + 1} + 1 = ?`, choices: ['1', '2', `${i + 2}`, '9'], answer: 3, solution: `ตอบข้อ 3 เพราะ ${i + 2}`,
        topic: 'การบวก', ...(i === 4 ? { image: 'figures/m5.png' } : {}), needsReview: i === 7, reviewNote: i === 7 ? 'ตรวจ' : '',
      })),
      { id: 's-1', exam: 'extra-sci-1', subject: 'science', no: 1, type: 'choice', text: 'น้ำเดือดที่กี่องศา', choices: ['50', '100'], answer: 2 },
    ],
  };
  over(bank);
  return zipSync({
    'bank/examprep-questions.json': strToU8(JSON.stringify(bank)),
    'bank/figures/p1.png': PNG,
    'bank/figures/m5.png': PNG,
    'bank/report.md': strToU8('# report'),
  });
}

async function setup(name: string) {
  const db = new ExamDB(name);
  await applyPlan(db, plan);
  return db;
}

async function ctxOf(db: ExamDB): Promise<TaskCtx> {
  const topics = await db.topics.toArray();
  const states = rebuildStates(await db.attempts.toArray());
  const statesByTopic = new Map<number, Map<number, import('../types').ProblemState>>();
  for (const s of states.values()) {
    if (!statesByTopic.has(s.topicId)) statesByTopic.set(s.topicId, new Map());
    statesByTopic.get(s.topicId)!.set(s.problemNo, s);
  }
  return {
    topicByKey: new Map(topics.map((t) => [t.key!, t])),
    statesByTopic,
    doneIds: new Set((await db.taskDone.toArray()).map((d) => d.taskId)),
    mockExams: await db.mockExams.toArray(),
  };
}

describe('plan import', () => {
  it('creates subjects, topics and settings from the plan', async () => {
    const db = await setup('pi1');
    const s = (await db.settings.get('main'))!;
    expect(s).toMatchObject({ planMode: 'plan', examDate: '2027-03-27', startDate: '2026-11-09', phase1End: '2027-01-21', restWeekdays: [0] });
    expect(s.phaseLabels?.map((p) => p.name)).toEqual(['โจทย์ท้ายบท', 'Pretest', 'ทบทวนก่อนสอบ']);
    expect(await db.subjects.count()).toBe(5);
    expect(await db.topics.count()).toBe(52);
    expect((await db.topics.where('key').equals('prep-eng-01').first())?.problemCount).toBe(80);
  });

  it('keeps the parent PIN and profile when re-applied', async () => {
    const db = await setup('pi2');
    const s = (await db.settings.get('main'))!;
    await applyPlan(db, plan, { ...s, parentPin: '1234', setupDone: true, profile: { studentName: 'น้องเอ', targetScore: 160 } });
    expect(await db.settings.get('main')).toMatchObject({ parentPin: '1234', setupDone: true, profile: { studentName: 'น้องเอ', targetScore: 160, school: 'โรงเรียนปากช่อง' } });
  });
});

describe('bank import', () => {
  it('reads and summarises a zip with a top-level folder', () => {
    const r = readBank(fixtureBank());
    expect(r.errors).toEqual([]);
    expect(r.summary).toMatchObject({ exams: 2, questions: 16, withAnswer: 16, figures: 2, passages: 1, needsReview: 1, bySubject: { math: 15, science: 1 } });
  });

  it('reports broken references in Thai', () => {
    const r = readBank(fixtureBank((b) => {
      const qs = b.questions as Record<string, unknown>[];
      qs[0].answer = 7;
      qs[1].image = 'figures/missing.png';
      qs[2].passage = 'nope';
      qs[3].exam = 'ghost';
    }));
    expect(r.bank).toBeNull();
    expect(r.errors.join('\n')).toMatch(/คำตอบ 7 ไม่อยู่ในตัวเลือก 1–4/);
    expect(r.errors.join('\n')).toMatch(/ไม่พบไฟล์รูป "figures\/missing.png"/);
    expect(r.errors.join('\n')).toMatch(/ไม่พบบทอ่าน "nope"/);
    expect(r.errors.join('\n')).toMatch(/ไม่พบชุด "ghost"/);
    expect(readBank(new Uint8Array([1, 2, 3])).errors[0]).toMatch(/zip/);
  });

  it('attaches questions to plan topics and adds unknown exams as extra topics', async () => {
    const db = await setup('bi1');
    await applyBank(db, readBank(fixtureBank()));
    expect(await db.questions.where('setKey').equals('prep-math-01').count()).toBe(15);
    expect((await db.questions.get('prep-math-01:5'))?.image).toBe('figures/m5.png');
    expect(await db.figures.count()).toBe(2);
    const extra = (await db.topics.where('key').equals('extra-sci-1').first())!;
    expect(extra).toMatchObject({ kind: 'extra', name: 'ชุดเสริม', problemCount: 1 });
    expect((await db.subjects.get(extra.subjectId))?.key).toBe('science');
    // re-import replaces, doesn't duplicate
    await applyBank(db, readBank(fixtureBank()));
    expect(await db.questions.count()).toBe(16);
    expect(await db.topics.where('key').equals('extra-sci-1').count()).toBe(1);
  });

  it('shortens exam titles for topic names', () => {
    expect(shortExamTitle('ข้อสอบวิชาคณิตศาสตร์ บทที่ 4 เศษส่วน')).toBe('บทที่ 4 เศษส่วน');
    expect(shortExamTitle('ชุดเสริม')).toBe('ชุดเสริม');
  });
});

describe('task progress', () => {
  it('a chapter task completes when its range is answered, with a first-try score', async () => {
    const db = await setup('tp1');
    const task = plan.tasks.find((t) => t.date === '2026-11-09')!;
    const topic = (await db.topics.where('key').equals('prep-math-01').first())!;
    expect(taskStatus(task, await ctxOf(db))).toMatchObject({ done: false, answered: 0, size: 15 });
    await saveMarks(db, Array.from({ length: 15 }, (_, i) => ({ topicId: topic.id!, problemNo: i + 1, result: i < 12 ? ('correct' as const) : ('wrong' as const) })), '2026-11-09', false);
    expect(taskStatus(task, await ctxOf(db))).toMatchObject({ done: true, answered: 15, correct: 12 });
  });

  it('split chapters only need their own range; manual tasks need a tick', async () => {
    const db = await setup('tp2');
    const thai = (await db.topics.where('key').equals('prep-thai-01').first())!;
    await saveMarks(db, Array.from({ length: 10 }, (_, i) => ({ topicId: thai.id!, problemNo: i + 1, result: 'correct' as const })), '2026-11-10', false);
    const ctx = await ctxOf(db);
    expect(taskStatus(plan.tasks.find((t) => t.date === '2026-11-10')!, ctx).done).toBe(true);
    expect(taskStatus(plan.tasks.find((t) => t.date === '2026-11-17')!, ctx).done).toBe(false);
    const sat = plan.tasks.find((t) => t.date === '2026-11-14')!;
    expect(taskStatus(sat, ctx).done).toBe(false);
    await db.taskDone.put({ taskId: sat.id, doneAt: 1 });
    expect(taskStatus(sat, await ctxOf(db)).done).toBe(true);
  });

  it('overdue list and gap vs plan', async () => {
    const db = await setup('tp3');
    const ctx = await ctxOf(db);
    // On 12 Nov: 9, 10, 11 Nov due (kickoff on 7 Nov is not counted)
    expect(overdue(plan.tasks, '2026-11-12', ctx).map((t) => t.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(taskGap(plan.tasks, '2026-11-12', ctx)).toMatchObject({ due: 3, done: 0, gap: -3, missed: 3 });
  });

  it('mock tasks complete when scores are entered', async () => {
    const db = await setup('tp4');
    const mock = plan.tasks.find((t) => t.type === 'mock' && t.mock === 1)!;
    await db.mockExams.put({ n: 1, date: mock.date, scores: { thai: 30, math: null } });
    expect(taskStatus(mock, await ctxOf(db)).done).toBe(true);
  });
});

describe('backup v4', () => {
  it('round-trips plan, bank, figures and practice through a zip', async () => {
    const db = await setup('bk1');
    await applyBank(db, readBank(fixtureBank()));
    const topic = (await db.topics.where('key').equals('prep-math-01').first())!;
    await saveMarks(db, [{ topicId: topic.id!, problemNo: 1, result: 'wrong', reason: 'careless' }], '2026-11-09', false);
    await db.mockExams.put({ n: 1, date: '2027-02-06', scores: { thai: 31 } });
    await db.taskDone.put({ taskId: 'x', doneAt: 1 });
    const zip = await exportBackupZip(db);
    const { backup, figures } = readBackupFile(zip);
    expect(backup.version).toBe(4);
    const db2 = new ExamDB('bk2');
    await importBackup(db2, backup, figures);
    expect(await db2.questions.count()).toBe(16);
    expect(await db2.figures.count()).toBe(2);
    expect(new Uint8Array((await db2.figures.get('figures/m5.png'))!.data)).toEqual(PNG);
    expect((await db2.plan.get('main'))?.plan.tasks.length).toBe(plan.tasks.length);
    expect((await db2.problemStates.get(`${topic.id}:1`))?.status).toBe('wrong');
    expect((await db2.mockExams.get(1))?.scores.thai).toBe(31);
  });

  it('still reads v3 JSON backups', () => {
    const v3 = { app: 'examprep', version: 3, exportedAt: '', data: { settings: [], subjects: [], topics: [], attempts: [], dailyLogs: [], mockSets: [] } };
    expect(readBackupFile(strToU8(JSON.stringify(v3))).backup.version).toBe(3);
  });
});

describe('plan curve', () => {
  it('accumulates planned problems by the plan dates', () => {
    const pts = planCurve(plan.tasks, [], '2026-11-10');
    expect(pts[0]).toMatchObject({ date: '2026-11-07', plan: 0, actual: 0 });
    expect(pts.find((p) => p.date === '2026-11-09')!.plan).toBe(15);
    expect(pts.find((p) => p.date === '2026-11-10')!.plan).toBe(25);
    expect(pts.find((p) => p.date === '2026-11-11')!.actual).toBeNull();
    expect(pts.at(-1)!.plan).toBe(740 + 570); // all chapter problems + all pretest problems
  });
});
