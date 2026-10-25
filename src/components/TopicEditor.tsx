import { Sparkles } from 'lucide-react';
import { ICON } from './ui';
import { useEffect, useRef, useState } from 'react';
import { parseTopicLines } from '../db/defaults';
import { replaceTopics } from '../db/actions';
import { db } from '../db/db';
import type { Subject, Topic } from '../types';
import { DEFAULT_TEMPLATE_COUNT, MAX_TEMPLATE_COUNT, clampCount, templateFor, templateText } from '../db/templates';

/** Edit one subject's topics as plain text: one line per topic, "ชื่อหัวข้อ, จำนวนข้อ". */
export default function TopicEditor({ subject, topics, onSaved }: { subject: Subject; topics: Topic[]; onSaved?: () => void }) {
  const initial = topics.map((t) => `${t.name}, ${t.problemCount}`).join('\n');
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  // Topics can change from outside (e.g. "fill all subjects" in setup). Follow them,
  // but only while the text has no unsaved edits.
  const lastInitial = useRef(initial);
  useEffect(() => {
    if (initial === lastInitial.current) return;
    setText((cur) => (cur === lastInitial.current ? initial : cur));
    lastInitial.current = initial;
  }, [initial]);
  const [count, setCount] = useState(String(topics[0]?.problemCount ?? DEFAULT_TEMPLATE_COUNT));
  const template = templateFor(subject.name);

  function useTemplate() {
    if (text.trim() && !confirm('แทนที่หัวข้อที่พิมพ์ไว้ด้วยหัวข้อตัวอย่าง?')) return;
    setText(templateText(template!, clampCount(count)));
    setSaved(false);
  }
  const parsed = parseTopicLines(text);
  const badLines = text.split('\n').filter((l) => l.trim()).length - parsed.length;
  const total = parsed.reduce((n, t) => n + t.problemCount, 0);
  const removed = topics.filter((t) => !parsed.some((p) => p.name === t.name));

  async function save() {
    if (removed.length && !confirm(`ลบหัวข้อ ${removed.map((t) => t.name).join(', ')} และประวัติการทำโจทย์ของหัวข้อนี้?`)) return;
    await replaceTopics(db, subject.id!, parsed);
    setSaved(true);
    onSaved?.();
  }

  return (
    <div className="space-y-2">
      {template && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 p-2 text-sm text-fg">
          <button className="btn-ghost bg-card text-sm" onClick={useTemplate}>
            <Sparkles size={ICON.sm} aria-hidden /> ใส่หัวข้อตัวอย่าง ({template.length} หัวข้อ)
          </button>
          <label className="flex items-center gap-1">
            ข้อละ
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_TEMPLATE_COUNT}
              className="input w-20 px-2 text-center"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-label="จำนวนข้อต่อหัวข้อ"
            />
            ข้อ
          </label>
        </div>
      )}
      <textarea
        aria-label={`หัวข้อวิชา${subject.name}`}
        className="input min-h-40 font-mono text-sm leading-relaxed"
        placeholder={'ตัวอย่าง\nเศษส่วน, 40\nทศนิยม, 30\nร้อยละ, 25'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      {template && <p className="text-xs text-muted-fg">หัวข้อตัวอย่างอิงหลักสูตร ป.4–6 แก้ชื่อ จำนวนข้อ หรือลบบรรทัดให้ตรงกับหนังสือได้ก่อนกดบันทึก</p>}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-fg">
          {parsed.length} หัวข้อ · {total} ข้อ
          {badLines > 0 && <span className="text-danger"> · {badLines} บรรทัดอ่านไม่ได้</span>}
        </span>
        <button className="btn-primary" onClick={save} disabled={text === initial || parsed.length === 0}>
          {saved ? 'บันทึกแล้ว ✓' : 'บันทึกหัวข้อ'}
        </button>
      </div>
    </div>
  );
}
