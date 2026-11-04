import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ExamDB } from '../db/db';
import { saveMarks } from '../db/actions';
import planJson from '../../public/plans/teacher-m1-2570.json';
import { validatePlan, type PlanFile } from './planSchema';
import { applyPlan } from './importPlan';
import { applyBank, readBank } from './importBank';
import { nextRange, taskStatus, type TaskCtx } from './progress';
import { isCorrect } from '../components/Quiz';
import type { Question } from '../types';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 1]);

// Invented questions in the 1.1 format (a ม.4-style chemistry set).
function bank11(over: (b: Record<string, unknown>) => void = () => {}) {
  const b = {
    format: 'examprep-questions', version: 1.1, textFormat: 'rich',
    subjects: [{ id: 'chemistry', name: 'เคมี', color: '#7c3aed' }],
    exams: [{ id: 'm4-chem-1', title: 'ข้อสอบวิชาเคมี ชุดที่ 1', source: { book: 'คู่มือเคมี ม.4', license: 'ใช้ส่วนตัว' } }],
    passages: [{ id: 'listen-1', exam: 'm4-chem-1', subject: 'chemistry', text: 'ฟังแล้วตอบ', audio: 'audio/l1.mp3' }],
    questions: [
      { id: 'c1', exam: 'm4-chem-1', subject: 'chemistry', no: 1, type: 'multi', text: 'ข้อใด**เป็นโลหะ**', choices: ['Na', { text: 'Cl' }, { image: 'figures/fe.png' }, 'Ne'], answer: [1, 3], points: 2, tags: ['ตารางธาตุ'], page: 12 },
      { id: 'c2', exam: 'm4-chem-1', subject: 'chemistry', no: 2, type: 'choice', text: 'มวลโมเลกุล $H_2O$', choices: ['16', '18'], answer: null, passage: 'listen-1' },
      { id: 'c3', exam: 'm4-chem-1', subject: 'chemistry', no: 3, type: 'short', text: 'สัญลักษณ์ทองคำ', answer: 'Au', format: 'plain' },
    ],
  };
  over(b);
  return zipSync({ 'examprep-questions.json': strToU8(JSON.stringify(b)), 'figures/fe.png': PNG, 'audio/l1.mp3': MP3 });
}

describe('question bank 1.1', () => {
  it('accepts free subjects, choice objects, multi answers, audio and rich text', () => {
    const r = readBank(bank11());
    expect(r.errors).toEqual([]);
    expect(r.summary).toMatchObject({ questions: 3, figures: 1, audio: 1, bySubject: { chemistry: 3 } });
  });

  it('checks new fields', () => {
    const errs = readBank(bank11((b) => {
      const qs = b.questions as Record<string, unknown>[];
      qs[0].answer = [1, 9];
      qs[0].choices = ['a', { image: 'figures/missing.png' }];
      qs[1].subject = 'เคมี';
      qs[2].points = -1;
      (b.passages as Record<string, unknown>[])[0].audio = 'audio/none.mp3';
    })).errors.join('\n');
    expect(errs).toMatch(/คำตอบต้องเป็นรายการเลขตัวเลือก 1–2/);
    expect(errs).toMatch(/ตัวเลือกที่ 2: ไม่พบไฟล์รูป "figures\/missing.png"/);
    expect(errs).toMatch(/วิชา "เคมี" ต้องเป็นตัวอักษรอังกฤษ/);
    expect(errs).toMatch(/points ต้องเป็นตัวเลข/);
    expect(errs).toMatch(/ไม่พบไฟล์เสียง "audio\/none.mp3"/);
  });

  it('still accepts version 1 files unchanged', () => {
    const v1 = zipSync({ 'examprep-questions.json': strToU8(JSON.stringify({
      format: 'examprep-questions', version: 1, exams: [{ id: 'e', title: 't' }],
      questions: [{ id: 'q', exam: 'e', subject: 'math', no: 1, type: 'choice', text: 'x', choices: ['1', '2'], answer: 1 }],
    })) });
    expect(readBank(v1).errors).toEqual([]);
  });

  it('stores the new fields and creates a named subject', async () => {
    const db = new ExamDB('v11a');
    await applyPlan(db, planJson as unknown as PlanFile);
    await applyBank(db, readBank(bank11()));
    const q1 = (await db.questions.get('m4-chem-1:1'))!;
    expect(q1).toMatchObject({ type: 'multi', answer: [1, 3], points: 2, tags: ['ตารางธาตุ'], format: 'rich', source: 'คู่มือเคมี ม.4 · หน้า 12' });
    expect((await db.questions.get('m4-chem-1:3'))!.format).toBe('plain');
    expect((await db.passages.get('listen-1'))!.audio).toBe('audio/l1.mp3');
    expect((await db.figures.get('audio/l1.mp3'))!.mime).toBe('audio/mpeg');
    expect(await db.figures.get('figures/fe.png')).toBeTruthy();
    const subject = (await db.subjects.where('key').equals('chemistry').first())!;
    expect(subject).toMatchObject({ name: 'เคมี', color: '#7c3aed' });
  });
});

describe('answer checking', () => {
  const q = (over: Partial<Question>): Question => ({ key: 'k', setKey: 's', no: 1, type: 'choice', text: '', answer: 2, ...over });
  it('single, multi, short, and unkeyed', () => {
    expect(isCorrect(q({}), [2], '', null)).toBe(true);
    expect(isCorrect(q({}), [1], '', null)).toBe(false);
    expect(isCorrect(q({ type: 'multi', answer: [1, 3] }), [3, 1], '', null)).toBe(true);
    expect(isCorrect(q({ type: 'multi', answer: [1, 3] }), [1], '', null)).toBe(false);
    expect(isCorrect(q({ type: 'multi', answer: [1, 3] }), [1, 2, 3], '', null)).toBe(false);
    expect(isCorrect(q({ type: 'short', answer: 'Au' }), [], ' au ', null)).toBe(true);
    expect(isCorrect(q({ answer: null }), [1], '', true)).toBe(true);
    expect(isCorrect(q({ answer: null }), [1], '', false)).toBe(false);
  });
});

describe('plan 1.1', () => {
  const base = JSON.parse(JSON.stringify(planJson)) as PlanFile;

  it('bundled plan is 1.1 and review days reference their chapters', () => {
    expect(base.version).toBe(1.1);
    const t = base.tasks.find((x) => x.date === '2026-12-23')!;
    expect(t.sets).toEqual([{ set: 'prep-soc-01' }, { set: 'prep-soc-02' }]);
  });

  it('validates multi-set tasks, custom tasks and mock sets', () => {
    const p = JSON.parse(JSON.stringify(base));
    p.tasks.push({ id: 'c1', date: '2026-11-15', type: 'custom', title: 'ติวพิเศษ', sets: [{ set: 'prep-math-01', from: 1, to: 5 }, { set: 'prep-math-02', from: 1, to: 5 }] });
    p.mocks[0].sets = ['prep-math-01'];
    expect(validatePlan(p).errors).toEqual([]);
    p.tasks.at(-1).sets[1].to = 99;
    p.mocks[1].sets = ['ghost'];
    const e = validatePlan(p).errors.join('\n');
    expect(e).toMatch(/sets\[1\]\.from\/to: ช่วงข้อ 1–99/);
    expect(e).toMatch(/mocks\[1\]\.sets\[0\]: ไม่พบชุด "ghost"/);
  });

  it('a multi-set task completes when every ranged set is answered; references do not count', async () => {
    const db = new ExamDB('v11b');
    await applyPlan(db, base);
    const topics = await db.topics.toArray();
    const byKey = new Map(topics.map((t) => [t.key!, t]));
    const task = { id: 'c1', date: '2026-11-15', type: 'custom' as const, title: 'x', sets: [{ set: 'prep-math-01', from: 1, to: 2 }, { set: 'prep-math-02', from: 1, to: 2 }, { set: 'prep-math-03' }] };
    const ctxOf = async (): Promise<TaskCtx> => {
      const states = await db.problemStates.toArray();
      const statesByTopic = new Map<number, Map<number, (typeof states)[number]>>();
      for (const s of states) {
        if (!statesByTopic.has(s.topicId)) statesByTopic.set(s.topicId, new Map());
        statesByTopic.get(s.topicId)!.set(s.problemNo, s);
      }
      return { topicByKey: byKey, statesByTopic, doneIds: new Set(), mockExams: [] };
    };
    const m1 = byKey.get('prep-math-01')!.id!;
    const m2 = byKey.get('prep-math-02')!.id!;
    await saveMarks(db, [{ topicId: m1, problemNo: 1, result: 'correct' }, { topicId: m1, problemNo: 2, result: 'correct' }], '2026-11-15', false);
    let ctx = await ctxOf();
    expect(taskStatus(task, ctx)).toMatchObject({ done: false, answered: 2, size: 4 });
    expect(nextRange(task, ctx)).toMatchObject({ set: 'prep-math-02' });
    await saveMarks(db, [{ topicId: m2, problemNo: 1, result: 'wrong' }, { topicId: m2, problemNo: 2, result: 'correct' }], '2026-11-15', false);
    ctx = await ctxOf();
    expect(taskStatus(task, ctx)).toMatchObject({ done: true, answered: 4, size: 4, correct: 3 });
    // a review day with reference-only sets needs a manual tick
    expect(taskStatus(base.tasks.find((x) => x.date === '2026-12-23')!, ctx).done).toBe(false);
  });
});
