import { describe, expect, it } from 'vitest';
import { DEFAULT_SUBJECTS, parseTopicLines } from './defaults';
import { clampCount, templateFor, templateText, TOPIC_TEMPLATES } from './templates';

describe('topic templates', () => {
  it('cover every default subject', () => {
    for (const s of DEFAULT_SUBJECTS) expect(templateFor(s.name)?.length).toBeGreaterThan(5);
    expect(templateFor('วิชาที่ไม่มี')).toBeNull();
  });

  it('have unique names per subject', () => {
    for (const names of Object.values(TOPIC_TEMPLATES)) expect(new Set(names).size).toBe(names.length);
  });

  it('round-trip through the topic parser with the chosen count', () => {
    for (const names of Object.values(TOPIC_TEMPLATES)) {
      const parsed = parseTopicLines(templateText(names, 25));
      expect(parsed.map((p) => p.name)).toEqual(names);
      expect(parsed.every((p) => p.problemCount === 25)).toBe(true);
    }
  });

  it('clamps counts', () => {
    expect(clampCount('20')).toBe(20);
    expect(clampCount('')).toBe(20);
    expect(clampCount(0)).toBe(20);
    expect(clampCount(-5)).toBe(20);
    expect(clampCount(12.6)).toBe(13);
    expect(clampCount(5000)).toBe(300);
  });
});
