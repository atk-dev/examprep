import { describe, expect, it } from 'vitest';
import { formatClock, generateSet, remainingSec, scoreSet, seededRandom, usedSec } from './mock';
import { rebuildStates } from './review';
import { backupDue, foldLine, reminderICS } from './reminders';
import { defaultSettings } from '../db/defaults';
import type { Attempt, MockSet, Subject, Topic } from '../types';

const subjects: Subject[] = [
  { id: 1, name: 'คณิต', color: '#000', order: 0 },
  { id: 2, name: 'วิทย์', color: '#000', order: 1 },
  { id: 3, name: 'อังกฤษ', color: '#000', order: 2 },
];
const topics: Topic[] = [
  { id: 10, subjectId: 1, name: 'ก', order: 0, problemCount: 30, summaryRead: true },
  { id: 11, subjectId: 1, name: 'ข', order: 1, problemCount: 30, summaryRead: true },
  { id: 20, subjectId: 2, name: 'ค', order: 0, problemCount: 40, summaryRead: true },
  { id: 30, subjectId: 3, name: 'ง', order: 0, problemCount: 3, summaryRead: true },
];
// problems 1-5 of topic 10 are open mistakes
const attempts: Attempt[] = [1, 2, 3, 4, 5].map((n) => ({ topicId: 10, problemNo: n, date: '2026-10-25', result: 'wrong', isReview: false, createdAt: n }));
const states = rebuildStates(attempts);

describe('mock sets', () => {
  it('splits evenly, never repeats, groups by subject', () => {
    const set = generateSet({ subjects, topics, states, subjectIds: [1, 2], size: 20, random: seededRandom(1) });
    expect(set).toHaveLength(20);
    expect(set.filter((x) => x.subjectId === 1)).toHaveLength(10);
    expect(new Set(set.map((x) => `${x.topicId}:${x.problemNo}`)).size).toBe(20);
    expect(set.findIndex((x) => x.subjectId === 2)).toBe(10);
  });

  it('gives leftover seats to subjects with more problems', () => {
    const set = generateSet({ subjects, topics, states, subjectIds: [1, 3], size: 10, random: seededRandom(2) });
    expect(set.filter((x) => x.subjectId === 3)).toHaveLength(3);
    expect(set).toHaveLength(10);
  });

  it('caps at the number of problems available', () => {
    expect(generateSet({ subjects, topics, states, subjectIds: [3], size: 10 })).toHaveLength(3);
  });

  it('favors open mistakes', () => {
    let hits = 0;
    for (let seed = 0; seed < 200; seed++) {
      const set = generateSet({ subjects, topics, states, subjectIds: [1], size: 5, random: seededRandom(seed) });
      hits += set.filter((x) => x.topicId === 10 && x.problemNo <= 5).length;
    }
    // 5 of 60 problems (8%) are open mistakes; weighting should more than double their share (~25%)
    expect(hits / 1000).toBeGreaterThan(0.2);
  });

  it('is reproducible with a seed', () => {
    const a = generateSet({ subjects, topics, states, subjectIds: [1, 2, 3], size: 12, random: seededRandom(7) });
    const b = generateSet({ subjects, topics, states, subjectIds: [1, 2, 3], size: 12, random: seededRandom(7) });
    expect(a).toEqual(b);
  });

  it('timer and score', () => {
    const m: MockSet = { date: '2026-10-25', status: 'active', startedAt: 0, limitSec: 600, items: [] };
    expect(remainingSec(m, 61_000)).toBe(539);
    expect(remainingSec(m, 700_000)).toBe(0);
    expect(usedSec({ ...m, stoppedAt: 120_000 }, 999_000)).toBe(120);
    expect(formatClock(539)).toBe('8:59');
    const items = [{ subjectId: 1, topicId: 10, problemNo: 1 }, { subjectId: 1, topicId: 10, problemNo: 2 }, { subjectId: 2, topicId: 20, problemNo: 1 }];
    expect(scoreSet(items, [{ result: 'correct' }, { result: 'wrong' }, { result: 'correct' }])).toEqual({
      correct: 2,
      total: 3,
      bySubject: [{ subjectId: 1, correct: 1, total: 2 }, { subjectId: 2, correct: 1, total: 1 }],
    });
  });
});

describe('reminders', () => {
  const s = { ...defaultSettings('2026-10-25'), restWeekdays: [0], reminderTime: '18:30' };

  it('folds long lines by bytes', () => {
    const line = 'DESCRIPTION:' + 'ก'.repeat(60);
    const parts = foldLine(line).split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('builds a daily reminder skipping rest days, plus the exam', () => {
    const ics = reminderICS(s, '2026-10-26', 'https://example.org/', new Date('2026-10-25T00:00:00Z'));
    const flat = ics.replace(/\r\n /g, '');
    expect(flat).toContain('DTSTART:20261026T183000');
    expect(flat).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA;UNTIL=20270326T235959');
    expect(flat).toContain('DTSTART;VALUE=DATE:20270327');
    expect(flat.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('backup reminder after a week', () => {
    const now = Date.parse('2026-11-10T00:00:00Z');
    expect(backupDue(s, false, now)).toBe(false);
    expect(backupDue(s, true, now)).toBe(true);
    expect(backupDue({ ...s, lastBackupAt: now - 2 * 86400000 }, true, now)).toBe(false);
    expect(backupDue({ ...s, lastBackupAt: now - 8 * 86400000 }, true, now)).toBe(true);
  });
});
