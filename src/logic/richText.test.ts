import { describe, expect, it } from 'vitest';
import { hasMath, parseRich, richToPlain } from './richText';

describe('rich text', () => {
  it('plain text passes through', () => {
    expect(parseRich('ข้อใดถูกต้อง')).toEqual([{ t: 'text', v: 'ข้อใดถูกต้อง' }]);
  });
  it('bold, underline, italic and math', () => {
    expect(parseRich('คำว่า __ไป__ เป็น **กริยา** และ $\\frac{3}{4}$ *ครับ*')).toEqual([
      { t: 'text', v: 'คำว่า ' },
      { t: 'u', c: [{ t: 'text', v: 'ไป' }] },
      { t: 'text', v: ' เป็น ' },
      { t: 'b', c: [{ t: 'text', v: 'กริยา' }] },
      { t: 'text', v: ' และ ' },
      { t: 'math', v: '\\frac{3}{4}' },
      { t: 'text', v: ' ' },
      { t: 'i', c: [{ t: 'text', v: 'ครับ' }] },
    ]);
  });
  it('nests marks and keeps unmatched markers as text', () => {
    expect(parseRich('**ตัวหนา __ขีดเส้น__**')).toEqual([{ t: 'b', c: [{ t: 'text', v: 'ตัวหนา ' }, { t: 'u', c: [{ t: 'text', v: 'ขีดเส้น' }] }] }]);
    expect(parseRich('2 * 3 = 6')).toEqual([{ t: 'text', v: '2 * 3 = 6' }]);
    expect(parseRich('ราคา $5')).toEqual([{ t: 'text', v: 'ราคา $5' }]);
  });
  it('escapes', () => {
    expect(parseRich('\\$5 และ \\$6')).toEqual([{ t: 'text', v: '$5 และ $6' }]);
    expect(richToPlain(parseRich('a __b__ $x^2$'))).toBe('a b x^2');
  });
  it('detects math', () => {
    expect(hasMath(parseRich('**$x$**'))).toBe(true);
    expect(hasMath(parseRich('ไม่มีสูตร'))).toBe(false);
  });
});
