import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { saveMarks, type Mark } from '../db/actions';
import { todayISO } from '../logic/dates';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason, ProblemState, Result } from '../types';
import { BookOpen, CheckCheck, PencilLine } from 'lucide-react';
import { CardTitle, ICON, PageTitle, Toast } from '../components/ui';

// Already-attempted problems: tint + ring + a small glyph, so status isn't shown by color alone.
const STATUS_LOOK: Record<ProblemState['status'], { cls: string; glyph: string; label: string }> = {
  done: { cls: 'ring-success/50 bg-success-bg text-success', glyph: '✓', label: 'ทำแล้ว ถูก' },
  mastered: { cls: 'ring-success/50 bg-success-bg text-success', glyph: '✓', label: 'แม่นแล้ว' },
  wrong: { cls: 'ring-danger/50 bg-danger-bg text-danger', glyph: '✗', label: 'ผิด รอทวน' },
  reviewing: { cls: 'ring-warning/50 bg-warning-bg text-warning', glyph: '↻', label: 'กำลังทวน' },
};

export default function Log({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const topicId = Number(params.get('topic')) || null;
  const topic = data.topics.find((t) => t.id === topicId) ?? null;
  const [subjectId, setSubjectId] = useState<number | null>(topic?.subjectId ?? data.subjects[0]?.id ?? null);
  const [marks, setMarks] = useState<Map<number, { result: Result; reason?: MistakeReason }>>(new Map());
  const [rangeTo, setRangeTo] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (topic) setSubjectId(topic.subjectId);
    setMarks(new Map());
    setRangeTo('');
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const states = (topicId && data.statesByTopic.get(topicId)) || new Map<number, ProblemState>();
  const subjectTopics = data.topics.filter((t) => t.subjectId === subjectId);
  const startAt = topicId ? data.firstUntried(topicId) : 1;

  const tp = useMemo(
    () => data.progress.flatMap((p) => p.topics).find((t) => t.topic.id === topicId),
    [data.progress, topicId],
  );

  function cycle(n: number) {
    const next = new Map(marks);
    const cur = next.get(n);
    if (!cur) next.set(n, { result: 'correct' });
    else if (cur.result === 'correct') next.set(n, { result: 'wrong' });
    else next.delete(n);
    setMarks(next);
  }

  function markRangeCorrect() {
    const to = Math.min(Number(rangeTo), topic!.problemCount);
    if (!to) return;
    const next = new Map(marks);
    for (let i = startAt; i <= to; i++) if (!states.has(i) && !next.has(i)) next.set(i, { result: 'correct' });
    setMarks(next);
  }

  function setReason(n: number, reason: MistakeReason) {
    const next = new Map(marks);
    next.set(n, { result: 'wrong', reason });
    setMarks(next);
  }

  async function save() {
    const list: Mark[] = [...marks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([problemNo, m]) => ({ topicId: topicId!, problemNo, ...m }));
    await saveMarks(db, list, todayISO(), false);
    const wrong = list.filter((m) => m.result === 'wrong').length;
    setMarks(new Map());
    setRangeTo('');
    setToast(`บันทึก ${list.length} ข้อแล้ว (ถูก ${list.length - wrong} ผิด ${wrong})`);
    setTimeout(() => setToast(''), 2500);
  }

  const wrongMarks = [...marks.entries()].filter(([, m]) => m.result === 'wrong').sort((a, b) => a[0] - b[0]);

  return (
    <>
      <PageTitle icon={PencilLine}>บันทึกโจทย์</PageTitle>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="เลือกวิชา">
        {data.subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSubjectId(s.id!);
              setParams({});
            }}
            className="chip"
            aria-pressed={subjectId === s.id}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor="log-topic">หัวข้อ</label>
      <select
        id="log-topic"
        className="input"
        value={topicId ?? ''}
        onChange={(e) => setParams(e.target.value ? { topic: e.target.value } : {})}
      >
        <option value="">— เลือกหัวข้อ —</option>
        {subjectTopics.map((t) => {
          const done = data.statesByTopic.get(t.id!)?.size ?? 0;
          return (
            <option key={t.id} value={t.id}>
              {t.name} ({done}/{t.problemCount})
            </option>
          );
        })}
      </select>

      {!subjectTopics.length && <p className="text-sm text-muted-fg">วิชานี้ยังไม่มีหัวข้อ เพิ่มได้ที่หน้าตั้งค่า</p>}

      {topic && (
        <>
          <label className="card flex min-h-14 items-center gap-3">
            <input
              type="checkbox"
              className="h-6 w-6 accent-[var(--color-primary)]"
              checked={topic.summaryRead}
              onChange={(e) => db.topics.update(topic.id!, { summaryRead: e.target.checked })}
            />
            <BookOpen size={ICON.md} className="text-primary" aria-hidden />
            <span className="font-semibold">อ่านสรุปหัวข้อนี้แล้ว</span>
          </label>

          <div className="card space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle>{topic.name}</CardTitle>
              <span className="shrink-0 text-sm text-muted-fg">ทำแล้ว {tp?.done ?? 0}/{topic.problemCount}</span>
            </div>
            <p className="rounded-2xl bg-primary/10 p-2.5 text-sm text-fg">
              แตะเลขข้อ <b>1 ครั้ง = ถูก ✓</b> · <b>2 ครั้ง = ผิด ✗</b> · 3 ครั้ง = ยกเลิก
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="range-to" className="shrink-0">ถูกหมดตั้งแต่ข้อ {startAt} ถึง</label>
              <input
                id="range-to"
                type="number"
                inputMode="numeric"
                className="input w-20 text-center"
                min={startAt}
                max={topic.problemCount}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
              <button className="btn-ghost" onClick={markRangeCorrect} disabled={!rangeTo}>
                <CheckCheck size={ICON.md} aria-hidden /> ทั้งช่วง
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
              {Array.from({ length: topic.problemCount }, (_, i) => i + 1).map((n) => {
                const m = marks.get(n);
                const st = states.get(n);
                const look = st ? STATUS_LOOK[st.status] : null;
                const cls = m
                  ? m.result === 'correct'
                    ? 'bg-success text-white shadow-[0_3px_0_0_#065f46]'
                    : 'bg-danger text-white shadow-[0_3px_0_0_#7f1d1d]'
                  : look
                    ? `ring-2 ring-inset ${look.cls}`
                    : 'bg-muted text-fg shadow-[0_3px_0_0_var(--color-border)]';
                const state = m ? (m.result === 'correct' ? 'เลือก ถูก' : 'เลือก ผิด') : look ? look.label : 'ยังไม่ทำ';
                return (
                  <button
                    key={n}
                    onClick={() => cycle(n)}
                    className={`relative aspect-square min-h-11 rounded-xl text-base font-bold transition-[transform,background-color] duration-100 active:scale-90 ${cls}`}
                    aria-label={`ข้อ ${n}, ${state}`}
                  >
                    {m ? (m.result === 'correct' ? '✓' : '✗') : n}
                    {!m && look && (
                      <span aria-hidden className="absolute right-1 bottom-0.5 text-xs leading-none">{look.glyph}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg" aria-label="ความหมายของสี">
              {(['done', 'wrong', 'reviewing'] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-md ring-2 ring-inset text-xs ${STATUS_LOOK[k].cls}`}>{STATUS_LOOK[k].glyph}</span>
                  {STATUS_LOOK[k].label}
                </li>
              ))}
            </ul>
          </div>

          {wrongMarks.length > 0 && (
            <div className="card space-y-3">
              <CardTitle>ผิดเพราะอะไร?</CardTitle>
              {wrongMarks.map(([n, m]) => (
                <div key={n}>
                  <div className="mb-1 text-sm font-semibold" id={`why-${n}`}>ข้อ {n}</div>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`why-${n}`}>
                    {(Object.keys(MISTAKE_LABELS) as MistakeReason[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReason(n, r)}
                        className="chip"
                        aria-pressed={m.reason === r}
                      >
                        {MISTAKE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10">
            <button className="btn-cta w-full py-3 text-base" disabled={!marks.size} onClick={save}>
              บันทึก {marks.size || ''} ข้อ
            </button>
          </div>
        </>
      )}

      {toast && <Toast>{toast}</Toast>}
    </>
  );
}
