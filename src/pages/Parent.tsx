import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WeekColumns, BarList } from '../components/charts';
import { ProgressBar, pct } from '../components/ui';
import { Tile } from './Stats';
import { formatThai, todayISO } from '../logic/dates';
import { planGap, reportText, weakTopics, weekSummary } from '../logic/insights';
import { currentPhase, daysUntilExam } from '../logic/plan';
import { reportImage } from '../logic/reportImage';
import { MISTAKE_LABELS } from '../logic/stats';
import type { AppData } from '../hooks/useAppData';
import type { MistakeReason } from '../types';

const UNLOCK_KEY = 'examprep.parentUnlocked';

function readUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Parent({ data }: { data: AppData }) {
  const s = data.settings!;
  const [unlocked, setUnlocked] = useState(() => !s.parentPin || readUnlocked());
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  if (!unlocked) {
    return (
      <div className="card mx-auto mt-10 max-w-xs space-y-3 text-center">
        <div className="text-4xl">👪</div>
        <h1 className="font-bold">สำหรับผู้ปกครอง</h1>
        <input
          className="input text-center text-2xl tracking-[0.5em]"
          inputMode="numeric"
          type="password"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setPin(v);
            if (v.length === 4) {
              if (v === s.parentPin) {
                try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch { /* private mode */ }
                setMsg('');
                setUnlocked(true);
              } else {
                setMsg('รหัสไม่ถูกต้อง');
                setPin('');
              }
            }
          }}
          aria-label="รหัส PIN"
        />
        {msg && <p className="text-sm text-rose-600">{msg}</p>}
        <Link to="/" className="block text-sm text-slate-500 underline">กลับ</Link>
      </div>
    );
  }

  const today = todayISO();
  const week = weekSummary(data.attempts, data.states, data.dailyLogs, today);
  const gap = planGap(s, today, data.states, data.total);
  const phase = currentPhase(s, today);
  const weak = weakTopics(data.progress, 5, 3);
  const onTrack = gap >= 0;
  const text = reportText({ settings: s, today, week, progress: data.progress, states: data.states, done: data.done, total: data.total, attempts: data.attempts });

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  async function shareImage() {
    const [, ...rest] = text.split('\n');
    const blob = await reportImage('รายงานประจำสัปดาห์', `${formatThai(week.from)} – ${formatThai(week.to)}`, rest);
    const file = new File([blob], `report-${today}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  async function shareText() {
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      flash('คัดลอกรายงานแล้ว วางใน LINE ได้เลย');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">👪 สรุปสำหรับผู้ปกครอง</h1>
        <Link to="/" className="text-sm text-slate-500 underline">กลับ</Link>
      </div>

      <section className={`rounded-2xl p-4 ${onTrack ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        <div className="text-lg font-bold">{onTrack ? '✅ เป็นไปตามแผน' : '⚠️ ช้ากว่าแผน'}</div>
        <div className="text-sm">
          {onTrack ? `นำแผน ${gap} ข้อ` : `ต้องเร่งอีก ${-gap} ข้อ`} · อีก {Math.max(daysUntilExam(s, today), 0)} วันสอบ ({formatThai(s.examDate)})
          {phase && <> · ช่วง{phase.name}</>}
        </div>
      </section>

      <section className="card">
        <h2 className="font-bold">7 วันที่ผ่านมา</h2>
        <p className="mb-3 text-xs text-slate-500">{formatThai(week.from)} – {formatThai(week.to)} · จำนวนข้อต่อวัน (รวมการทวน)</p>
        <WeekColumns days={week.perDay} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="โจทย์ใหม่" value={`${week.newDone}`} sub={`ทวน ${week.reviewed} ข้อ`} />
        <Tile label="ถูกครั้งแรก" value={pct(week.accuracy)} sub="สัปดาห์นี้" />
        <Tile label="วันที่เรียน" value={`${week.activeDays}/7`} sub="วัน" />
        <Tile label="เวลาเรียน" value={`${week.minutes}`} sub="นาที" />
      </div>

      <section className="card space-y-3">
        <h2 className="font-bold">รายวิชา</h2>
        {data.progress.filter((p) => p.total > 0).map((p) => (
          <div key={p.subject.id}>
            <div className="flex justify-between text-sm">
              <span>{p.subject.name}</span>
              <span className="text-slate-500">{p.done}/{p.total} · ถูก {pct(p.accuracy)}</span>
            </div>
            <ProgressBar className="mt-1" value={p.total ? p.done / p.total : 0} color={p.subject.color} />
          </div>
        ))}
      </section>

      {weak.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-bold">ควรช่วยเสริม</h2>
          <ul className="space-y-1 text-sm">
            {weak.map((w) => (
              <li key={w.t.topic.id}>• {w.subject.name} – {w.t.topic.name} <b>({pct(w.t.accuracy)})</b></li>
            ))}
          </ul>
        </section>
      )}

      {Object.values(week.mistakes).some((n) => n > 0) && (
        <section className="card">
          <h2 className="mb-3 font-bold">สาเหตุที่ผิดสัปดาห์นี้</h2>
          <BarList
            format={(v) => `${v} ข้อ`}
            rows={(Object.keys(MISTAKE_LABELS) as MistakeReason[]).map((r) => ({ key: r, label: MISTAKE_LABELS[r], value: week.mistakes[r], color: '#e11d48' }))}
          />
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-bold">ส่งรายงาน</h2>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={shareImage}>🖼️ ส่งเป็นรูป</button>
          <button className="btn-ghost flex-1" onClick={shareText}>💬 ส่งเป็นข้อความ</button>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">ดูข้อความ</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans">{text}</pre>
        </details>
        {!s.parentPin && <p className="text-xs text-slate-500">ตั้งรหัส PIN ได้ที่หน้าตั้งค่า เพื่อล็อกหน้านี้</p>}
      </section>

      {msg && <div className="fixed inset-x-4 top-4 z-20 mx-auto max-w-md rounded-xl bg-slate-900 p-3 text-center text-white shadow-lg">{msg}</div>}
    </>
  );
}
