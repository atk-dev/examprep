import { db } from '../db/db';
import { saveMarks } from '../db/actions';
import { formatThai, todayISO } from '../logic/dates';
import { dueReviews } from '../logic/review';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { ProblemState, Result } from '../types';

export default function Review({ data }: { data: AppData }) {
  const today = todayISO();
  const due = dueReviews(data.states, today);
  const upcoming = data.states.filter((s) => s.nextReview && s.nextReview > today).length;
  const topicById = new Map(data.topics.map((t) => [t.id!, t]));
  const subjectById = new Map(data.subjects.map((s) => [s.id!, s]));

  const answer = (s: ProblemState, result: Result) =>
    saveMarks(db, [{ topicId: s.topicId, problemNo: s.problemNo, result, reason: result === 'wrong' ? s.lastReason : undefined }], today, true);

  return (
    <>
      <h1 className="text-xl font-bold">🔁 ทวนข้อผิด</h1>
      <p className="text-sm text-slate-500">
        ทำข้อเดิมใหม่โดยไม่ดูเฉลย ถ้าถูกจะเว้นไป 3 วัน แล้ว 7 วัน ถูก 3 รอบติดถือว่าแม่นแล้ว
      </p>
      {due.length === 0 && (
        <div className="card text-center text-slate-500">
          ไม่มีข้อที่ต้องทวนวันนี้ 🎉
          {upcoming > 0 && <div className="text-sm">มีอีก {upcoming} ข้อรอทวนวันหลัง</div>}
        </div>
      )}
      {due.map((s) => {
        const t = topicById.get(s.topicId);
        const sub = t && subjectById.get(t.subjectId);
        if (!t || !sub) return null;
        return (
          <div key={s.key} className="card flex items-center gap-3">
            <span className="h-12 w-1.5 rounded-full" style={{ background: sub.color }} />
            <div className="flex-1">
              <div className="text-xs text-slate-500">{sub.name} · {t.name}</div>
              <div className="font-semibold">ข้อ {s.problemNo}</div>
              <div className="text-xs text-slate-500">
                ผิด {s.wrongCount} ครั้ง{s.lastReason && ` · ${MISTAKE_LABELS[s.lastReason]}`}
                {s.nextReview! < today && ` · ค้างจาก ${formatThai(s.nextReview!)}`}
              </div>
            </div>
            <button className="btn bg-emerald-500 text-white" onClick={() => answer(s, 'correct')} aria-label="ถูก">✓</button>
            <button className="btn bg-rose-500 text-white" onClick={() => answer(s, 'wrong')} aria-label="ผิด">✗</button>
          </div>
        );
      })}
    </>
  );
}
