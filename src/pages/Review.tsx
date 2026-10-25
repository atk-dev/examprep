import { useSearchParams } from 'react-router-dom';
import ProblemCard from '../components/ProblemCard';
import { PageTitle, Segmented } from '../components/ui';
import { RotateCcw } from 'lucide-react';
import { todayISO } from '../logic/dates';
import { dueReviews } from '../logic/review';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason, ProblemState } from '../types';

type StatusFilter = 'open' | 'mastered' | 'all';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'open', label: 'ยังไม่แม่น' },
  { id: 'mastered', label: 'แม่นแล้ว' },
  { id: 'all', label: 'ทั้งหมด' },
];

function Chip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button onClick={onClick} className="chip" aria-pressed={on}>
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}

export default function Review({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'notebook' ? 'notebook' : 'due';
  const subjectF = Number(params.get('subject')) || null;
  const reasonF = (params.get('reason') as MistakeReason | null) ?? null;
  const statusF = (params.get('status') as StatusFilter | null) ?? 'open';
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const today = todayISO();
  const topicById = new Map(data.topics.map((t) => [t.id!, t]));
  const subjectById = new Map(data.subjects.map((s) => [s.id!, s]));
  const due = dueReviews(data.states, today);
  const upcoming = data.states.filter((s) => s.nextReview && s.nextReview > today).length;

  const everWrong = data.states.filter((s) => s.wrongCount > 0);
  const notebook = everWrong
    .filter((s) => {
      const t = topicById.get(s.topicId);
      if (!t) return false;
      if (subjectF && t.subjectId !== subjectF) return false;
      if (reasonF && s.lastReason !== reasonF) return false;
      if (statusF === 'open') return s.status === 'wrong' || s.status === 'reviewing';
      if (statusF === 'mastered') return s.status === 'mastered';
      return true;
    })
    .sort((a, b) => b.wrongCount - a.wrongCount || b.lastDate.localeCompare(a.lastDate) || a.problemNo - b.problemNo);

  const card = (s: ProblemState) => {
    const t = topicById.get(s.topicId);
    const sub = t && subjectById.get(t.subjectId);
    return t && sub ? <ProblemCard key={s.key} state={s} topic={t} subject={sub} note={data.notes.get(s.key)} /> : null;
  };

  return (
    <>
      <PageTitle icon={RotateCcw}>ทวนข้อผิด</PageTitle>
      <Segmented
        label="มุมมอง"
        value={tab}
        onChange={(t) => setParams(t === 'notebook' ? { tab: 'notebook' } : {}, { replace: true })}
        options={[
          { id: 'due', label: `ถึงกำหนด (${due.length})` },
          { id: 'notebook', label: `สมุดข้อผิด (${everWrong.length})` },
        ]}
      />

      {tab === 'due' && (
        <>
          <p className="text-sm text-muted-fg">
            ทำข้อเดิมใหม่โดยไม่ดูเฉลย ถ้าถูกจะเว้นไป 3 วัน แล้ว 7 วัน ถูก 3 รอบติดถือว่าแม่นแล้ว
          </p>
          {due.length === 0 && (
            <div className="card text-center text-muted-fg">
              ไม่มีข้อที่ต้องทวนวันนี้ 🎉
              {upcoming > 0 && <div className="text-sm">มีอีก {upcoming} ข้อรอทวนวันหลัง</div>}
            </div>
          )}
          {due.map(card)}
        </>
      )}

      {tab === 'notebook' && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="กรองตามวิชา">
            <Chip on={!subjectF} onClick={() => set('subject', null)}>ทุกวิชา</Chip>
            {data.subjects.map((s) => (
              <Chip key={s.id} on={subjectF === s.id} color={s.color} onClick={() => set('subject', String(s.id))}>
                {s.name}
              </Chip>
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="กรองตามสาเหตุ">
            <Chip on={!reasonF} onClick={() => set('reason', null)}>ทุกสาเหตุ</Chip>
            {(Object.keys(MISTAKE_LABELS) as MistakeReason[]).map((r) => (
              <Chip key={r} on={reasonF === r} onClick={() => set('reason', r)}>{MISTAKE_LABELS[r]}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามสถานะ">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.id} on={statusF === f.id} onClick={() => set('status', f.id === 'open' ? null : f.id)}>{f.label}</Chip>
            ))}
          </div>
          <p className="text-sm text-muted-fg">{notebook.length} ข้อ · เรียงจากข้อที่ผิดบ่อยที่สุด · ทำใหม่ได้ทุกเมื่อ</p>
          {notebook.length === 0 && <div className="card text-center text-muted-fg">ไม่มีข้อในหมวดนี้</div>}
          {notebook.map(card)}
        </>
      )}
    </>
  );
}
