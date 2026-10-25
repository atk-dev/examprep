import { useState } from 'react';
import { db } from '../db/db';
import { saveMarks, saveNote } from '../db/actions';
import { formatThai, todayISO } from '../logic/dates';
import { MISTAKE_LABELS } from '../logic/stats';
import type { ProblemState, Result, Subject, Topic } from '../types';

const STATUS: Record<ProblemState['status'], { label: string; cls: string }> = {
  wrong: { label: 'รอทวน', cls: 'bg-rose-100 text-rose-700' },
  reviewing: { label: 'กำลังทวน', cls: 'bg-amber-100 text-amber-700' },
  mastered: { label: 'แม่นแล้ว', cls: 'bg-emerald-100 text-emerald-700' },
  done: { label: 'ถูก', cls: 'bg-emerald-100 text-emerald-700' },
};

/** One problem with its history, a note, and ✓/✗ buttons to record a redo. */
export default function ProblemCard({ state: s, topic, subject, note }: { state: ProblemState; topic: Topic; subject: Subject; note?: string }) {
  const today = todayISO();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? '');

  const answer = (result: Result) =>
    saveMarks(db, [{ topicId: s.topicId, problemNo: s.problemNo, result, reason: result === 'wrong' ? s.lastReason : undefined }], today, true);

  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: subject.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-slate-500">{subject.name} · {topic.name}</div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">ข้อ {s.problemNo}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
          </div>
          <div className="text-xs text-slate-500">
            ผิด {s.wrongCount} ครั้ง{s.lastReason && ` · ${MISTAKE_LABELS[s.lastReason]}`}
            {s.nextReview && (s.nextReview < today ? ` · ค้างจาก ${formatThai(s.nextReview)}` : s.nextReview > today ? ` · ทวน ${formatThai(s.nextReview)}` : '')}
          </div>
        </div>
        <button className="btn bg-emerald-500 px-3 text-white" onClick={() => answer('correct')} aria-label="ถูก">✓</button>
        <button className="btn bg-rose-500 px-3 text-white" onClick={() => answer('wrong')} aria-label="ผิด">✗</button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            className="input min-h-20 text-sm"
            placeholder="จุดสำคัญจากเฉลย / ทำไมถึงผิด"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost py-1 text-sm" onClick={() => { setText(note ?? ''); setEditing(false); }}>ยกเลิก</button>
            <button className="btn-primary py-1 text-sm" onClick={async () => { await saveNote(db, s.topicId, s.problemNo, text); setEditing(false); }}>บันทึกโน้ต</button>
          </div>
        </div>
      ) : note ? (
        <button className="w-full rounded-lg bg-amber-50 p-2 text-left text-sm whitespace-pre-wrap text-amber-900" onClick={() => setEditing(true)}>
          📝 {note}
        </button>
      ) : (
        <button className="text-xs text-indigo-600" onClick={() => setEditing(true)}>+ เพิ่มโน้ต</button>
      )}
    </div>
  );
}
