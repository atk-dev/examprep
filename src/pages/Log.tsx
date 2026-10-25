import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { saveMarks, type Mark } from '../db/actions';
import { todayISO } from '../logic/dates';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason, ProblemState, Result } from '../types';

const STATUS_RING: Record<ProblemState['status'], string> = {
  done: 'ring-emerald-300 bg-emerald-50 text-emerald-800',
  mastered: 'ring-emerald-300 bg-emerald-50 text-emerald-800',
  wrong: 'ring-rose-300 bg-rose-50 text-rose-800',
  reviewing: 'ring-amber-300 bg-amber-50 text-amber-800',
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
      <h1 className="text-xl font-bold">✏️ บันทึกโจทย์</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {data.subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSubjectId(s.id!);
              setParams({});
            }}
            className={`btn shrink-0 py-1.5 text-sm ${subjectId === s.id ? 'text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            style={subjectId === s.id ? { background: s.color } : undefined}
          >
            {s.name}
          </button>
        ))}
      </div>

      <select
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

      {!subjectTopics.length && <p className="text-sm text-slate-500">วิชานี้ยังไม่มีหัวข้อ เพิ่มได้ที่หน้าตั้งค่า</p>}

      {topic && (
        <>
          <label className="card flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-indigo-600"
              checked={topic.summaryRead}
              onChange={(e) => db.topics.update(topic.id!, { summaryRead: e.target.checked })}
            />
            <span>📖 อ่านสรุปหัวข้อนี้แล้ว</span>
          </label>

          <div className="card space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                ทำแล้ว {tp?.done ?? 0}/{topic.problemCount} · แตะ 1 ครั้ง = ✓ · 2 ครั้ง = ✗
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="shrink-0">ถูกหมดตั้งแต่ข้อ {startAt} ถึง</span>
              <input
                type="number"
                inputMode="numeric"
                className="input w-20 py-1"
                min={startAt}
                max={topic.problemCount}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
              <button className="btn-ghost py-1" onClick={markRangeCorrect} disabled={!rangeTo}>✓ ทั้งช่วง</button>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: topic.problemCount }, (_, i) => i + 1).map((n) => {
                const m = marks.get(n);
                const st = states.get(n);
                const cls = m
                  ? m.result === 'correct'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-rose-500 text-white'
                  : st
                    ? `ring-2 ${STATUS_RING[st.status]}`
                    : 'bg-slate-100 text-slate-700';
                return (
                  <button
                    key={n}
                    onClick={() => cycle(n)}
                    className={`aspect-square rounded-lg text-sm font-semibold transition active:scale-90 ${cls}`}
                    aria-label={`ข้อ ${n}`}
                  >
                    {m ? (m.result === 'correct' ? '✓' : '✗') : n}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>🟩 ทำแล้วถูก</span>
              <span>🟥 ผิด รอทวน</span>
              <span>🟨 กำลังทวน</span>
            </div>
          </div>

          {wrongMarks.length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-bold">ผิดเพราะอะไร?</h2>
              {wrongMarks.map(([n, m]) => (
                <div key={n}>
                  <div className="mb-1 text-sm font-semibold">ข้อ {n}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(MISTAKE_LABELS) as MistakeReason[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReason(n, r)}
                        className={`rounded-full px-3 py-1 text-sm ${m.reason === r ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}
                      >
                        {MISTAKE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sticky bottom-20 z-10">
            <button className="btn-primary w-full py-3 shadow-lg" disabled={!marks.size} onClick={save}>
              บันทึก {marks.size || ''} ข้อ
            </button>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed inset-x-4 top-4 z-20 mx-auto max-w-md rounded-xl bg-slate-900 p-3 text-center text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
