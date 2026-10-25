import { useState } from 'react';
import { db } from '../db/db';
import { saveMarks, saveNote } from '../db/actions';
import { formatThai, todayISO } from '../logic/dates';
import { MISTAKE_LABELS } from '../logic/stats';
import type { ProblemState, Result, Subject, Topic } from '../types';
import { Check, StickyNote, X } from 'lucide-react';
import { ICON } from './ui';

const STATUS: Record<ProblemState['status'], { label: string; cls: string }> = {
  wrong: { label: 'รอทวน', cls: 'bg-danger-bg text-danger' },
  reviewing: { label: 'กำลังทวน', cls: 'bg-warning-bg text-warning' },
  mastered: { label: 'แม่นแล้ว', cls: 'bg-success-bg text-success' },
  done: { label: 'ถูก', cls: 'bg-success-bg text-success' },
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
          <div className="truncate text-xs text-muted-fg">{subject.name} · {topic.name}</div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">ข้อ {s.problemNo}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
          </div>
          <div className="text-xs text-muted-fg">
            ผิด {s.wrongCount} ครั้ง{s.lastReason && ` · ${MISTAKE_LABELS[s.lastReason]}`}
            {s.nextReview && (s.nextReview < today ? ` · ค้างจาก ${formatThai(s.nextReview)}` : s.nextReview > today ? ` · ทวน ${formatThai(s.nextReview)}` : '')}
          </div>
        </div>
        <button className="btn h-12 w-12 shrink-0 bg-success p-0 text-white shadow-[0_3px_0_0_#065f46]" onClick={() => answer('correct')} aria-label={`ข้อ ${s.problemNo} ทำใหม่ ถูก`}>
          <Check size={ICON.lg} strokeWidth={3} aria-hidden />
        </button>
        <button className="btn h-12 w-12 shrink-0 bg-danger p-0 text-white shadow-[0_3px_0_0_#7f1d1d]" onClick={() => answer('wrong')} aria-label={`ข้อ ${s.problemNo} ทำใหม่ ผิด`}>
          <X size={ICON.lg} strokeWidth={3} aria-hidden />
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <label className="sr-only" htmlFor={`note-${s.key}`}>โน้ตข้อ {s.problemNo}</label>
          <textarea
            id={`note-${s.key}`}
            autoFocus
            className="input min-h-20 text-sm"
            placeholder="จุดสำคัญจากเฉลย / ทำไมถึงผิด"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={() => { setText(note ?? ''); setEditing(false); }}>ยกเลิก</button>
            <button className="btn-primary text-sm" onClick={async () => { await saveNote(db, s.topicId, s.problemNo, text); setEditing(false); }}>บันทึกโน้ต</button>
          </div>
        </div>
      ) : note ? (
        <button className="flex min-h-11 w-full items-start gap-2 rounded-2xl bg-warning-bg p-3 text-left text-sm whitespace-pre-wrap text-warning" onClick={() => setEditing(true)} aria-label={`แก้โน้ต: ${note}`}>
          <StickyNote size={ICON.sm} className="mt-0.5 shrink-0" aria-hidden />
          <span>{note}</span>
        </button>
      ) : (
        <button className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary" onClick={() => setEditing(true)}>+ เพิ่มโน้ต</button>
      )}
    </div>
  );
}
