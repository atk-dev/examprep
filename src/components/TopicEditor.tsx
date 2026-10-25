import { useState } from 'react';
import { parseTopicLines } from '../db/defaults';
import { replaceTopics } from '../db/actions';
import { db } from '../db/db';
import type { Subject, Topic } from '../types';

/** Edit one subject's topics as plain text: one line per topic, "ชื่อหัวข้อ, จำนวนข้อ". */
export default function TopicEditor({ subject, topics, onSaved }: { subject: Subject; topics: Topic[]; onSaved?: () => void }) {
  const initial = topics.map((t) => `${t.name}, ${t.problemCount}`).join('\n');
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
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
      <textarea
        className="input min-h-36 font-mono text-sm"
        placeholder={'ตัวอย่าง\nเศษส่วน, 40\nทศนิยม, 30\nร้อยละ, 25'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">
          {parsed.length} หัวข้อ · {total} ข้อ
          {badLines > 0 && <span className="text-rose-600"> · {badLines} บรรทัดอ่านไม่ได้</span>}
        </span>
        <button className="btn-primary py-1.5" onClick={save} disabled={text === initial}>
          {saved ? 'บันทึกแล้ว ✓' : 'บันทึกหัวข้อ'}
        </button>
      </div>
    </div>
  );
}
