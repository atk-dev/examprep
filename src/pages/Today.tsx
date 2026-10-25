import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { formatThai, todayISO } from '../logic/dates';
import { planGap, weakTopics } from '../logic/insights';
import { backupDue } from '../logic/reminders';
import { pct } from '../components/ui';
import { currentPhase, dailyQuota, daysUntilExam, isRestDay } from '../logic/plan';
import { dueReviews } from '../logic/review';
import { streak } from '../logic/stats';
import { suggestToday } from '../logic/suggest';
import { ProgressBar, Ring } from '../components/ui';
import type { AppData } from '../hooks/useAppData';

export default function Today({ data }: { data: AppData }) {
  const s = data.settings!;
  const today = todayISO();
  const daysLeft = daysUntilExam(s, today);
  const phase = currentPhase(s, today);

  const doneTodayNew = data.states.filter((x) => x.firstDate === today).length;
  const remaining = data.total - data.done;
  const quota = dailyQuota(s, today, remaining, doneTodayNew);
  const quotaLeft = Math.max(0, quota - doneTodayNew);
  const suggestions = suggestToday(data.progress, quotaLeft, today, data.firstUntried);
  const due = dueReviews(data.states, today);
  const reviewedToday = data.attempts.filter((a) => a.date === today && a.isReview).length;
  const gap = planGap(s, today, data.states, data.total);
  const days = streak(data.attempts, today);
  const minutes = data.dailyLogs.find((l) => l.date === today)?.minutes ?? 0;

  const weak = weakTopics(data.progress, 5, 3);
  const mockToday = data.mockSets.some((m) => m.status === 'done' && m.date === today);
  const mockActive = data.mockSets.some((m) => m.status === 'active');
  const showBackup = backupDue(s, data.attempts.length > 0);

  const addMinutes = (n: number) => db.dailyLogs.put({ date: today, minutes: Math.max(0, minutes + n) });

  return (
    <>
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow">
        <div className="flex items-start justify-between">
          <div className="text-sm opacity-80">{s.examName} · {formatThai(s.examDate)}</div>
          <Link to="/parent" className="rounded-full bg-white/15 px-2.5 py-1 text-xs">👪 ผู้ปกครอง</Link>
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-5xl font-bold">{Math.max(daysLeft, 0)}</span>
          <span className="pb-1.5 text-lg">วันก่อนสอบ</span>
        </div>
        {phase && (
          <div className="mt-3 rounded-xl bg-white/15 p-3 text-sm">
            <b>{phase.name}</b> (ถึง {formatThai(phase.end)})
            <div className="opacity-90">{phase.goal}</div>
          </div>
        )}
        <div className="mt-3 flex gap-4 text-sm">
          <span>🔥 ต่อเนื่อง {days} วัน</span>
          <span>
            {gap >= 0 ? `✅ นำแผน ${gap} ข้อ` : `⚠️ ช้ากว่าแผน ${-gap} ข้อ`}
          </span>
        </div>
      </section>

      {showBackup && (
        <Link to="/settings" className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <span className="text-xl">💾</span>
          <span className="flex-1">ข้อมูลอยู่ในเครื่องนี้เท่านั้น สำรองข้อมูลไว้กันหาย (ไม่ได้สำรองมาเกิน 7 วัน)</span>
          <span>›</span>
        </Link>
      )}

      {mockActive && (
        <Link to="/mock" className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-200">
          <span className="text-xl">⏱️</span>
          <span className="flex-1">มีชุดจับเวลาที่ยังไม่เสร็จ</span>
          <span>›</span>
        </Link>
      )}

      {phase?.id === 'phase2' && (
        <section className="card space-y-2 ring-2 ring-indigo-200">
          <h2 className="font-bold">🎯 เป้าหมายช่วงนี้: ปิดจุดอ่อน</h2>
          <p className="text-sm text-slate-600">ทวนข้อที่ถึงกำหนดทุกวัน แล้วทำข้อที่ยังไม่แม่นในสมุดข้อผิด เริ่มจากหัวข้อเหล่านี้</p>
          {weak.length ? (
            <ul className="text-sm">
              {weak.map((w) => (
                <li key={w.t.topic.id}>
                  <Link to={`/review?tab=notebook&subject=${w.subject.id}`} className="flex justify-between py-1">
                    <span>• {w.subject.name} – {w.t.topic.name}</span>
                    <b>{pct(w.t.accuracy)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-700">ไม่มีหัวข้อที่ต่ำกว่า 80% เยี่ยมมาก! ลองฝึกจับเวลาได้เลย</p>
          )}
          <Link to="/review?tab=notebook" className="btn-primary w-full">เปิดสมุดข้อผิด</Link>
        </section>
      )}

      {phase?.id === 'phase3' && (
        <section className="card space-y-2 ring-2 ring-indigo-200">
          <h2 className="font-bold">⏱️ เป้าหมายช่วงนี้: ฝึกจับเวลาวันละ 1 ชุด</h2>
          <p className="text-sm text-slate-600">ทำคละวิชาให้ชินกับเวลาจริง แล้วทวนข้อที่ผิดจากชุดนั้นวันถัดไป</p>
          {mockToday ? (
            <p className="text-sm text-emerald-700">วันนี้ทำแล้ว ✓</p>
          ) : (
            <Link to="/mock" className="btn-primary w-full">เริ่มชุดวันนี้</Link>
          )}
        </section>
      )}

      {phase?.id === 'final' && (
        <section className="card space-y-1 ring-2 ring-emerald-200">
          <h2 className="font-bold">🌙 สัปดาห์สุดท้าย</h2>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            <li>ทวนโน้ตในสมุดข้อผิด ไม่ต้องเริ่มเรื่องใหม่</li>
            <li>นอนให้ครบ 8–9 ชั่วโมง ตื่นเวลาเดียวกับวันสอบ</li>
            <li>เตรียมบัตร เครื่องเขียน และดูเส้นทางไปสนามสอบ</li>
          </ul>
        </section>
      )}

      <section className="card flex items-center gap-4">
        <Ring value={quota ? doneTodayNew / quota : 1}>
          <span className="text-2xl font-bold">{doneTodayNew}</span>
          <span className="text-xs text-slate-500">/ {quota} ข้อ</span>
        </Ring>
        <div className="flex-1">
          <h2 className="font-bold">โจทย์ใหม่วันนี้</h2>
          {isRestDay(s, today) && quota === 0 ? (
            <p className="text-sm text-slate-500">วันนี้เป็นวันพัก 😴 ทวนข้อผิดได้ถ้าอยากทำ</p>
          ) : quotaLeft === 0 && quota > 0 ? (
            <p className="text-sm text-emerald-700">ครบโควต้าแล้ว เก่งมาก! 🎉</p>
          ) : remaining === 0 ? (
            <p className="text-sm text-emerald-700">ทำครบทุกข้อแล้ว! เน้นทวนข้อผิด</p>
          ) : (
            <p className="text-sm text-slate-500">เหลืออีก {quotaLeft} ข้อ</p>
          )}
          <ProgressBar className="mt-2" value={data.total ? data.done / data.total : 0} />
          <p className="mt-1 text-xs text-slate-500">
            ทั้งหมด {data.done} / {data.total} ข้อ
          </p>
        </div>
      </section>

      {suggestions.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-bold">แนะนำวันนี้</h2>
          {suggestions.map((x) => (
            <Link
              key={x.topic.topic.id}
              to={`/log?topic=${x.topic.topic.id}`}
              className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 active:bg-slate-100"
            >
              <span className="h-10 w-1.5 rounded-full" style={{ background: x.subject.subject.color }} />
              <div className="flex-1">
                <div className="text-sm text-slate-500">{x.subject.subject.name}</div>
                <div className="font-semibold">{x.topic.topic.name}</div>
                <div className="text-xs text-slate-500">
                  {x.readSummaryFirst && '📖 อ่านสรุปก่อน · '}เริ่มข้อ {x.startAt} · ประมาณ {x.count} ข้อ
                </div>
              </div>
              <span className="text-slate-400">›</span>
            </Link>
          ))}
        </section>
      )}

      <section className="card flex items-center justify-between">
        <div>
          <h2 className="font-bold">🔁 ทวนข้อผิด</h2>
          <p className="text-sm text-slate-500">
            {due.length ? `ถึงกำหนด ${due.length} ข้อ` : 'วันนี้ไม่มีข้อต้องทวน'}
            {reviewedToday > 0 && ` · ทวนแล้ว ${reviewedToday}`}
          </p>
        </div>
        {due.length > 0 && <Link to="/review" className="btn-primary">เริ่มทวน</Link>}
      </section>

      {phase?.id !== 'phase3' && !mockActive && (
        <section className="card flex items-center justify-between">
          <div>
            <h2 className="font-bold">⏱️ ฝึกจับเวลา</h2>
            <p className="text-sm text-slate-500">ชุดโจทย์คละวิชา{mockToday ? ' · วันนี้ทำแล้ว ✓' : ''}</p>
          </div>
          <Link to="/mock" className="btn-ghost">เปิด</Link>
        </section>
      )}

      <section className="card">
        <h2 className="font-bold">🕒 เวลาเรียนวันนี้</h2>
        <div className="mt-2 flex items-center gap-2">
          <button className="btn-ghost" onClick={() => addMinutes(-15)} disabled={minutes === 0}>−15</button>
          <div className="flex-1 text-center text-2xl font-bold">{minutes} <span className="text-sm font-normal text-slate-500">นาที</span></div>
          <button className="btn-ghost" onClick={() => addMinutes(15)}>+15</button>
          <button className="btn-ghost" onClick={() => addMinutes(30)}>+30</button>
        </div>
      </section>
    </>
  );
}
