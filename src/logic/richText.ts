/**
 * Tiny markup for question text (bank `format: "rich"`):
 *   **bold**  __underline__  *italic*  $LaTeX math$   \$ = a literal dollar sign
 * Anything else is plain text; line breaks are kept by the renderer.
 */
export type RichToken =
  | { t: 'text'; v: string }
  | { t: 'math'; v: string }
  | { t: 'b' | 'u' | 'i'; c: RichToken[] };

const MARKS: { open: string; t: 'b' | 'u' | 'i' }[] = [
  { open: '**', t: 'b' },
  { open: '__', t: 'u' },
  { open: '*', t: 'i' },
];

export function parseRich(src: string): RichToken[] {
  const out: RichToken[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && (src[i + 1] === '$' || src[i + 1] === '*' || src[i + 1] === '_')) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '$') {
      const end = findClose(src, '$', i + 1);
      if (end > i + 1 && !src.slice(i + 1, end).includes('\n')) {
        flush();
        out.push({ t: 'math', v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    const mark = MARKS.find((m) => src.startsWith(m.open, i));
    if (mark) {
      const end = findClose(src, mark.open, i + mark.open.length);
      if (end > i + mark.open.length) {
        flush();
        out.push({ t: mark.t, c: parseRich(src.slice(i + mark.open.length, end)) });
        i = end + mark.open.length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Index of the next unescaped `mark` at or after `from`, or -1. */
function findClose(src: string, mark: string, from: number): number {
  for (let j = from; j <= src.length - mark.length; j++) {
    if (src[j] === '\\') {
      j++;
      continue;
    }
    if (src.startsWith(mark, j)) {
      // "**" must not be mistaken for a closing "*"
      if (mark === '*' && src[j + 1] === '*') {
        j++;
        continue;
      }
      return j;
    }
  }
  return -1;
}

export const hasMath = (tokens: RichToken[]): boolean =>
  tokens.some((t) => t.t === 'math' || ('c' in t && hasMath(t.c)));

/** Plain-text version (for aria labels, previews and search). */
export const richToPlain = (tokens: RichToken[]): string =>
  tokens.map((t) => (t.t === 'text' || t.t === 'math' ? t.v : richToPlain(t.c))).join('');
