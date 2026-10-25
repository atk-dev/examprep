import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { formatThai, todayISO } from '../logic/dates';
import { planGap, weakTopics } from '../logic/insights';
import { backupDue } from '../logic/reminders';
import { currentPhase, dailyQuota, daysUntilExam, isRestDay } from '../logic/plan';
import { dueReviews } from '../logic/review';
import { streak } from '../logic/stats';
import { suggestToday } from '../logic/suggest';
import { CardTitle, ICON, ProgressBar, Ring, pct } from '../components/ui';
import {
  BookOpen, ChevronRight, Clock, Flame, HardDriveDownload, Moon, RotateCcw, Target, Timer,
  TrendingDown, TrendingUp, Users,
} from 'lucide-react';
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

  const first = suggestions[0];

  return (
    <>
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-violet-600 p-5 text-white shadow-[0_12px_28px_-12px_rgb(79_70_229/0.7),inset_0_2px_0_rgb(255_255_255/0.25)]">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-sm text-white/90">
            {s.examName} · {formatThai(s.examDate)}
          </p>
          <Link to="/parent" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/20 px-3 text-sm font-semibold active:bg-white/30">
            <Users size={ICON.sm} aria-hidden /> ผู้ปกครอง
          </Link>
        </div>
        <div className="relative mt-1 flex items-end gap-2">
          <span className="font-display text-6xl font-bold leading-none">{Math.max(daysLeft, 0)}</span>
          <span className="pb-1 text-lg font-semibold">วันก่อนสอบ</span>
        </div>
        {phase && (
          <div className="relative mt-4 rounded-2xl bg-white/15 p-3 text-sm">
            <p className="font-bold">{phase.name} <span className="font-normal text-white/90">(ถึง {formatThai(phase.end)})</span></p>
            <p className="text-white/90">{phase.goal}</p>
          </div>
        )}
        <div className="relative mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
            <Flame size={ICON.sm} aria-hidden /> ต่อเนื่อง {days} วัน
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
            {gap >= 0 ? <TrendingUp size={ICON.sm} aria-hidden /> : <TrendingDown size={ICON.sm} aria-hidden />}
            {gap >= 0 ? `นำแผน ${gap} ข้อ` : `ช้ากว่าแผน ${-gap} ข้อ`}
          </span>
        </div>
      </section>

      {showBackup && (
        <Link to="/settings" className="card flex items-center gap-3 bg-warning-bg text-warning">
          <HardDriveDownload size={ICON.lg} className="shrink-0" aria-hidden />
          <span className="flex-1 text-sm font-semibold">ไม่ได้สำรองข้อมูลมาเกิน 7 วัน ข้อมูลอยู่ในเครื่องนี้เท่านั้น แตะเพื่อสำรอง</span>
          <ChevronRight size={ICON.md} aria-hidden />
        </Link>
      )}

      {mockActive && (
        <Link to="/mock" className="card flex items-center gap-3 bg-primary/10">
          <Timer size={ICON.lg} className="shrink-0 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-semibold">มีชุดจับเวลาที่ยังไม่เสร็จ แตะเพื่อทำต่อ</span>
          <ChevronRight size={ICON.md} aria-hidden />
        </Link>
      )}

      {phase?.id === 'phase2' && (
        <section className="card space-y-3 ring-2 ring-primary/30">
          <CardTitle icon={Target}>เป้าหมายช่วงนี้: ปิดจุดอ่อน</CardTitle>
          <p className="text-sm text-muted-fg">ทวนข้อที่ถึงกำหนดทุกวัน แล้วทำข้อที่ยังไม่แม่นในสมุดข้อผิด เริ่มจากหัวข้อเหล่านี้</p>
          {weak.length ? (
            <ul className="divide-y divide-muted text-sm">
              {weak.map((w) => (
                <li key={w.t.topic.id}>
                  <Link to={`/review?tab=notebook&subject=${w.subject.id}`} className="flex min-h-11 items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.subject.color }} aria-hidden />
                      {w.subject.name} – {w.t.topic.name}
                    </span>
                    <b>{pct(w.t.accuracy)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-success">ไม่มีหัวข้อที่ต่ำกว่า 80% เยี่ยมมาก ลองฝึกจับเวลาได้เลย</p>
          )}
          <Link to="/review?tab=notebook" className="btn-cta w-full">เปิดสมุดข้อผิด</Link>
        </section>
      )}

      {phase?.id === 'phase3' && (
        <section className="card space-y-3 ring-2 ring-primary/30">
          <CardTitle icon={Timer}>เป้าหมายช่วงนี้: ฝึกจับเวลาวันละ 1 ชุด</CardTitle>
          <p className="text-sm text-muted-fg">ทำคละวิชาให้ชินกับเวลาจริง แล้วทวนข้อที่ผิดจากชุดนั้นวันถัดไป</p>
          {mockToday ? (
            <p className="text-sm font-semibold text-success">วันนี้ทำแล้ว ✓</p>
          ) : (
            <Link to="/mock" className="btn-cta w-full">เริ่มชุดวันนี้</Link>
          )}
        </section>
      )}

      {phase?.id === 'final' && (
        <section className="card space-y-2 ring-2 ring-success/30">
          <CardTitle icon={Moon}>สัปดาห์สุดท้าย</CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-fg">
            <li>ทวนโน้ตในสมุดข้อผิด ไม่ต้องเริ่มเรื่องใหม่</li>
            <li>นอนให้ครบ 8–9 ชั่วโมง ตื่นเวลาเดียวกับวันสอบ</li>
            <li>เตรียมบัตร เครื่องเขียน และดูเส้นทางไปสนามสอบ</li>
          </ul>
        </section>
      )}

      <section className="card space-y-4">
        <div className="flex items-center gap-4">
          <Ring value={quota ? doneTodayNew / quota : 1}>
            <span className="font-display text-3xl font-bold">{doneTodayNew}</span>
            <span className="text-xs text-muted-fg">จาก {quota} ข้อ</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <CardTitle>โจทย์ใหม่วันนี้</CardTitle>
            {isRestDay(s, today) && quota === 0 ? (
              <p className="text-sm text-muted-fg">วันนี้เป็นวันพัก ทวนข้อผิดได้ถ้าอยากทำ</p>
            ) : quotaLeft === 0 && quota > 0 ? (
              <p className="text-sm font-semibold text-success">ครบโควต้าแล้ว เก่งมาก! 🎉</p>
            ) : remaining === 0 ? (
              <p className="text-sm font-semibold text-success">ทำครบทุกข้อแล้ว เน้นทวนข้อผิด</p>
            ) : (
              <p className="text-sm text-muted-fg">เหลืออีก <b className="text-fg">{quotaLeft}</b> ข้อ</p>
            )}
            <ProgressBar className="mt-2" value={data.total ? data.done / data.total : 0} />
            <p className="mt-1 text-xs text-muted-fg">ทั้งเล่ม {data.done} / {data.total} ข้อ</p>
          </div>
        </div>
        {first && (
          <Link to={`/log?topic=${first.topic.topic.id}`} className="btn-cta w-full py-3 text-base">
            เริ่มทำโจทย์: {first.topic.topic.name}
          </Link>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="card space-y-2">
          <CardTitle icon={BookOpen}>แนะนำวันนี้</CardTitle>
          <ul className="space-y-2">
            {suggestions.map((x) => (
              <li key={x.topic.topic.id}>
                <Link
                  to={`/log?topic=${x.topic.topic.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted/60 p-3 transition-colors duration-150 active:bg-muted"
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: x.subject.subject.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-muted-fg">{x.subject.subject.name}</span>
                    <span className="block font-semibold">{x.topic.topic.name}</span>
                    <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-fg">
                      {x.readSummaryFirst && (
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          <BookOpen size={14} aria-hidden /> อ่านสรุปก่อน ·
                        </span>
                      )}
                      เริ่มข้อ {x.startAt} · ประมาณ {x.count} ข้อ
                    </span>
                  </span>
                  <ChevronRight size={ICON.md} className="shrink-0 text-muted-fg" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex items-center justify-between gap-3">
        <div>
          <CardTitle icon={RotateCcw}>ทวนข้อผิด</CardTitle>
          <p className="text-sm text-muted-fg">
            {due.length ? `ถึงกำหนด ${due.length} ข้อ` : 'วันนี้ไม่มีข้อต้องทวน'}
            {reviewedToday > 0 && ` · ทวนแล้ว ${reviewedToday}`}
          </p>
        </div>
        {due.length > 0 && <Link to="/review" className="btn-primary shrink-0">เริ่มทวน</Link>}
      </section>

      {phase?.id !== 'phase3' && !mockActive && (
        <section className="card flex items-center justify-between gap-3">
          <div>
            <CardTitle icon={Timer}>ฝึกจับเวลา</CardTitle>
            <p className="text-sm text-muted-fg">ชุดโจทย์คละวิชา{mockToday ? ' · วันนี้ทำแล้ว ✓' : ''}</p>
          </div>
          <Link to="/mock" className="btn-ghost shrink-0">เปิด</Link>
        </section>
      )}

      <section className="card space-y-3">
        <CardTitle icon={Clock}>เวลาเรียนวันนี้</CardTitle>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => addMinutes(-15)} disabled={minutes === 0} aria-label="ลด 15 นาที">−15</button>
          <p className="flex-1 text-center" aria-live="polite">
            <span className="font-display text-3xl font-bold">{minutes}</span> <span className="text-sm text-muted-fg">นาที</span>
          </p>
          <button className="btn-ghost" onClick={() => addMinutes(15)} aria-label="เพิ่ม 15 นาที">+15</button>
          <button className="btn-ghost" onClick={() => addMinutes(30)} aria-label="เพิ่ม 30 นาที">+30</button>
        </div>
      </section>
    </>
  );
}
