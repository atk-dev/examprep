import { describe, expect, it } from 'vitest';
import raw from '../../public/plans/teacher-m1-2570.json';
import { validatePlan, type PlanFile } from './planSchema';

const plan = raw as unknown as PlanFile;
const on = (date: string) => plan.tasks.filter((t) => t.date === date);
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

describe('teacher plan (PDF ปฏิทินเตรียมสอบเข้า ม.1)', () => {
  it('passes the validator', () => {
    expect(validatePlan(raw).errors).toEqual([]);
  });

  it('has the exam and phases from the PDF', () => {
    expect(plan.exam.date).toBe('2027-03-27');
    expect(plan.exam.sessions.map((s) => `${s.subject} ${s.start} ${s.minutes}`)).toEqual([
      'thai 09:00 40', 'math 09:50 60', 'science 11:00 40', 'english 13:00 60', 'social 14:10 40',
    ]);
    expect(plan.exam.sessions.reduce((n, s) => n + s.questions, 0)).toBe(200);
    expect(plan.phases.map((p) => `${p.start}..${p.end}`)).toEqual([
      '2026-11-09..2027-01-21', '2027-01-25..2027-03-01', '2027-03-02..2027-03-26',
    ]);
  });

  it('matches the PDF day counts', () => {
    const count = (type: string) => plan.tasks.filter((t) => t.type === type).length;
    expect(count('practice')).toBe(47); // 39 chapters over 47 days
    expect(count('timed') + count('reviewWrong')).toBe(26); // 13 pretests, 2 days each
    expect(plan.tasks.filter((t) => t.type === 'subjectReview' && t.date >= '2027-03-02').length).toBe(19);
    expect(count('mock')).toBe(5);
    expect(count('practice') + count('timed') + count('reviewWrong')).toBe(73); // score sheet rows
    expect(plan.sets.filter((s) => s.kind === 'chapter')).toHaveLength(39);
    expect(plan.sets.filter((s) => s.kind === 'pretest')).toHaveLength(13);
  });

  it('chapter problem counts match the book per subject', () => {
    const total = (subject: string) => plan.sets.filter((s) => s.kind === 'chapter' && s.subject === subject).reduce((n, s) => n + s.count, 0);
    expect([total('math'), total('thai'), total('science'), total('english'), total('social')]).toEqual([210, 40, 180, 190, 120]);
  });

  it('every chapter is fully covered by its practice days', () => {
    for (const set of plan.sets.filter((s) => s.kind === 'chapter')) {
      const covered = new Set<number>();
      for (const t of plan.tasks.filter((x) => x.set === set.id)) for (let n = t.from!; n <= t.to!; n++) covered.add(n);
      expect(covered.size, set.id).toBe(set.count);
    }
  });

  it('spot-checks dates from the PDF checklist', () => {
    const at = (date: string) => on(date).map((t) => `${t.subject ?? ''}|${t.set ?? ''}|${t.from ?? ''}-${t.to ?? ''}`);
    expect(at('2026-11-09')).toEqual(['math|prep-math-01|1-15']);
    expect(at('2026-11-17')).toEqual(['thai|prep-thai-01|11-20']);
    expect(at('2026-12-04')).toEqual(['english|prep-eng-01|61-80']);
    expect(at('2027-01-08')).toEqual(['math|prep-math-10|1-15']);
    expect(at('2027-01-12')).toEqual(['english|prep-eng-04|16-30']);
    expect(at('2027-01-21')).toEqual(['math|prep-math-15|1-15']);
    expect(at('2027-01-25')).toEqual(['math|pretest-math-1|1-40']);
    expect(at('2027-01-29')).toEqual(['social|pretest-social-1|1-30']);
    expect(at('2027-02-03')).toEqual(['science|pretest-science-1|41-50']);
    expect(at('2027-02-11')).toEqual(['thai|pretest-thai-2|-']);
    expect(at('2027-03-01')).toEqual(['science|pretest-science-3|41-50']);
    expect(on('2027-01-22')[0].type).toBe('catchup');
    expect(on('2026-12-23')[0]).toMatchObject({ type: 'subjectReview', subject: 'social', title: 'ทวนบท 1–2' });
    expect(on('2027-03-08')[0]).toMatchObject({ type: 'subjectReview', subject: 'math' });
    expect(on('2027-03-26')[0]).toMatchObject({ type: 'subjectReview', subject: 'english' });
    expect(plan.mocks.map((m) => m.date)).toEqual(['2027-02-06', '2027-02-20', '2027-03-06', '2027-03-13', '2027-03-20']);
  });

  it('timers start in December with the PDF values', () => {
    const t = (date: string) => on(date)[0].minutes;
    expect(t('2026-11-30')).toBeNull();
    expect(t('2026-12-01')).toBe(10); // ไทย 10 ข้อ ⏱10′
    expect(t('2026-12-04')).toBe(30); // อังกฤษ 20 ข้อ ⏱30′
    expect(t('2026-12-07')).toBe(23); // คณิต 15 ข้อ ⏱23′
    expect(t('2026-12-21')).toBe(15); // คณิต 10 ข้อ ⏱15′
    expect(t('2027-01-25')).toBe(60);
    expect(t('2027-01-29')).toBe(30);
  });

  it('nothing on Sundays; Saturdays are review sessions except mock days', () => {
    expect(plan.tasks.filter((t) => weekday(t.date) === 0)).toEqual([]);
    const sats = plan.tasks.filter((t) => weekday(t.date) === 6);
    expect(sats.every((t) => ['saturday', 'mock', 'kickoff', 'exam'].includes(t.type))).toBe(true);
    expect(plan.tasks.filter((t) => t.type === 'saturday')).toHaveLength(14);
  });

  it('weekdays have exactly one task from 9 Nov to 26 Mar', () => {
    for (let d = new Date('2026-11-09T00:00:00Z'); d <= new Date('2027-03-26T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const wd = d.getUTCDay();
      if (wd >= 1 && wd <= 5) expect(on(iso).length, iso).toBe(1);
    }
  });
});

describe('plan validator', () => {
  const good = JSON.parse(JSON.stringify(raw));
  it('reports Thai path errors', () => {
    const bad = JSON.parse(JSON.stringify(good));
    bad.tasks[3].set = 'nope';
    bad.tasks[4].date = '2026/11/10';
    bad.sets[0].count = 0;
    bad.tasks.push({ ...bad.tasks[0] });
    const { plan: p, errors } = validatePlan(bad);
    expect(p).toBeNull();
    expect(errors.some((e) => e.startsWith('tasks[3].set') && e.includes('nope'))).toBe(true);
    expect(errors.some((e) => e.startsWith('tasks[4].date'))).toBe(true);
    expect(errors.some((e) => e.startsWith('sets[0].count'))).toBe(true);
    expect(errors.some((e) => e.includes('ซ้ำ'))).toBe(true);
  });
  it('rejects ranges outside a set', () => {
    const bad = JSON.parse(JSON.stringify(good));
    const i = bad.tasks.findIndex((t: { set?: string }) => t.set === 'prep-math-07');
    bad.tasks[i].to = 99;
    expect(validatePlan(bad).errors[0]).toContain('ไม่อยู่ใน 1–10');
  });
});
