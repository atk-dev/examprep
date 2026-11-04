import { useEffect, useMemo, useState } from 'react';
import { hasMath, parseRich, richToPlain, type RichToken } from '../logic/richText';

type Katex = typeof import('katex');
let katexPromise: Promise<Katex> | null = null;
/** KaTeX (and its CSS/fonts) load only when a question actually contains math. */
function loadKatex() {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([k]) => (k as unknown as { default: Katex }).default ?? k);
  return katexPromise;
}

function render(tokens: RichToken[], katex: Katex | null, key = ''): React.ReactNode[] {
  return tokens.map((t, i) => {
    const k = `${key}${i}`;
    if (t.t === 'text') return t.v;
    if (t.t === 'math') {
      if (!katex) return <code key={k} className="rounded bg-muted px-1">{t.v}</code>;
      // Display style keeps fractions full size, easier to read on a phone.
      const html = katex.renderToString(`\\displaystyle ${t.v}`, { throwOnError: false, output: 'htmlAndMathml' });
      return <span key={k} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    const inner = render(t.c, katex, `${k}-`);
    if (t.t === 'b') return <strong key={k}>{inner}</strong>;
    if (t.t === 'u') return <u key={k} className="decoration-2 underline-offset-4">{inner}</u>;
    return <em key={k}>{inner}</em>;
  });
}

/** Question text: plain, or rich (bold / underline / italic / LaTeX) when the bank says so. */
export default function RichText({ text, format, className = '', as: Tag = 'span', id }: {
  text: string;
  format?: 'plain' | 'rich';
  className?: string;
  as?: 'span' | 'p' | 'div';
  id?: string;
}) {
  const tokens = useMemo(() => (format === 'rich' ? parseRich(text) : null), [text, format]);
  const needsKatex = !!tokens && hasMath(tokens);
  const [katex, setKatex] = useState<Katex | null>(null);
  useEffect(() => {
    if (needsKatex) loadKatex().then(setKatex).catch(() => {});
  }, [needsKatex]);
  return (
    <Tag id={id} className={`whitespace-pre-wrap ${className}`}>
      {tokens ? render(tokens, katex) : text}
    </Tag>
  );
}

export const plainOf = (text: string, format?: 'plain' | 'rich') => (format === 'rich' ? richToPlain(parseRich(text)) : text);
