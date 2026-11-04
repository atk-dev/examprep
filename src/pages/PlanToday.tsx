import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, Flame, HardDriveDownload, Library, ListTodo, RotateCcw, Target, Timer, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { db } from '../db/db';
import { formatThai, todayISO } from '../logic/dates';
import { currentPhase, daysUntilExam } from '../logic/plan';
import { backupDue } from '../logic/reminders';
import { dueReviews } from '../logic/review';
import { streak } from '../logic/stats';
import { mockTotal, overdue, taskGap } from '../plan/progress';
import TaskCard, { TASK_LABEL } from '../components/TaskCard';
import { CardTitle, ICON } from '../components/ui';
import type { AppData } from '../hooks/useAppData';

export default function PlanToday({ data }: { data: AppData }) {
  const s = data.settings!;
  const plan = data.plan!;
  const today = todayISO();
  const daysLeft = daysUntilExam(s, today);
  const phase = currentPhase(s, today);
  const todays = data.tasks.filter((t) => t.date === today);
  const late = overdue(data.tasks, today, data.taskCtx);
  const gap = taskGap(data.tasks, today, data.taskCtx);
  const next = data.tasks.find((t) => t.date > today && t.type !== 'saturday');
  const due = dueReviews(data.states, today);
  const days = streak(data.attempts, today);
  const minutes = data.dailyLogs.find((l) => l.date === today)?.minutes ?? 0;
  const lastMock = [...data.mockExams].reverse().find((m) => mockTotal(m));
  const target = s.profile?.targetScore;
  const started = today >= plan.tasks[0].date;
  const addMinutes = (n: number) => db.dailyLogs.put({ date: today, minutes: Math.max(0, minutes + n) });

  return (
    <>
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-violet-600 p-5 text-white shadow-[0_12px_28px_-12px_rgb(79_70_229/0.7),inset_0_2px_0_rgb(255_255_255/0.25)]">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-sm text-white/90">
            {s.profile?.studentName ? `${s.profile.studentName} · ` : ''}{s.examName} · {formatThai(s.examDate)}
          </p>
          <Link to="/parent" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/20 px-3 text-sm font-semibold active:bg-white/30">
            <Users size={ICON.sm} aria-hidden /> ผู้ปกครอง
          </Link>
        </div>
        <div className="relative mt-1 flex items-end gap-2">
          <span className="font-display text-6xl font-bold leading-none">{Math.max(daysLeft, 0)}</span>
          <span className="pb-1 text-lg font-semibold">วันก่อนสอบ</span>
        </div>
        {phase && started && (
          <div className="relative mt-4 rounded-2xl bg-white/15 p-3 text-sm">
            <p className="font-bold">ช่วง{phase.name} <span className="font-normal text-white/90">(ถึง {formatThai(phase.end)})</span></p>
            {phase.goal && <p className="text-white/90">{phase.goal}</p>}
          </div>
        )}
        <div className="relative mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5"><Flame size={ICON.sm} aria-hidden /> ต่อเนื่อง {days} วัน</span>
          {gap.due > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
              {gap.gap >= 0 ? <TrendingUp size={ICON.sm} aria-hidden /> : <TrendingDown size={ICON.sm} aria-hidden />}
              {gap.gap >= 0 ? `ตามแผน${gap.gap > 0 ? ` นำ ${gap.gap} งาน` : ''}` : `ค้าง ${gap.missed} งาน`}
            </span>
          )}
          {target ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
              <Target size={ICON.sm} aria-hidden /> เป้า {target}{lastMock ? ` · ล่าสุด ${mockTotal(lastMock)}` : ''}/{plan.exam.totalScore ?? 200}
            </span>
          ) : null}
        </div>
      </section>

      {backupDue(s, data.attempts.length > 0) && (
        <Link to="/settings" className="card flex items-center gap-3 bg-warning-bg text-warning">
          <HardDriveDownload size={ICON.lg} className="shrink-0" aria-hidden />
          <span className="flex-1 text-sm font-semibold">ไม่ได้สำรองข้อมูลมาเกิน 7 วัน ข้อมูลอยู่ในเครื่องนี้เท่านั้น แตะเพื่อสำรอง</span>
          <ChevronRight size={ICON.md} aria-hidden />
        </Link>
      )}
      {data.questions.length === 0 && (
        <Link to="/settings" className="card flex items-center gap-3 bg-primary/10">
          <Library size={ICON.lg} className="shrink-0 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-semibold">นำเข้าคลังข้อสอบ เพื่อทำโจทย์และดูเฉลยในแอป</span>
          <ChevronRight size={ICON.md} aria-hidden />
        </Link>
      )}

      <h2 className="flex items-center gap-2 pt-1 text-lg font-bold"><ListTodo size={ICON.md} className="text-primary" aria-hidden /> งานวันนี้ · {formatThai(today)}</h2>
      {todays.length ? (
        todays.map((t) => <TaskCard key={t.id} t={t} data={data} />)
      ) : (
        <section className="card space-y-1">
          <CardTitle>{!started ? `แผนเริ่ม ${formatThai(plan.tasks[0].date)}` : s.restWeekdays.includes(new Date(`${today}T00:00:00`).getDay()) ? 'วันพัก 😴' : 'วันนี้ไม่มีงานในแผน'}</CardTitle>
          <p className="text-sm text-muted-fg">{late.length ? 'ทำงานที่ค้างได้ถ้ามีเวลา' : 'พักผ่อนให้เต็มที่'}</p>
        </section>
      )}

      {late.length > 0 && (
        <section className="card space-y-2">
          <CardTitle icon={Clock}>งานค้าง ({late.length})</CardTitle>
          <ul className="space-y-2">
            {late.slice(0, 5).map((t) => <li key={t.id}><TaskCard t={t} data={data} compact /></li>)}
          </ul>
          {late.length > 5 && <Link to="/progress?tab=plan" className="flex min-h-11 items-center text-sm font-semibold text-primary underline">ดูทั้งหมดในปฏิทิน</Link>}
        </section>
      )}

      {next && (
        <section className="card space-y-2">
          <CardTitle icon={CalendarDays}>งานถัดไป · {formatThai(next.date)}</CardTitle>
          <TaskCard t={next} data={data} compact />
          <Link to="/progress?tab=plan" className="flex min-h-11 items-center text-sm font-semibold text-primary underline">เปิดปฏิทินทั้งแผน</Link>
        </section>
      )}

      <section className="card flex items-center justify-between gap-3">
        <div>
          <CardTitle icon={RotateCcw}>ทวนข้อผิด</CardTitle>
          <p className="text-sm text-muted-fg">{due.length ? `ถึงกำหนด ${due.length} ข้อ` : 'วันนี้ไม่มีข้อต้องทวน'}</p>
        </div>
        {due.length > 0 && <Link to="/review" className="btn-primary shrink-0">เริ่มทวน</Link>}
      </section>

      {!todays.some((t) => t.type === 'mock') && (
        <section className="card flex items-center justify-between gap-3">
          <div>
            <CardTitle icon={Timer}>สอบจำลอง / ฝึกจับเวลา</CardTitle>
            <p className="text-sm text-muted-fg">{plan.mocks.length} ครั้งตามแผน · {TASK_LABEL.mock} ครั้งถัดไป {formatThai(plan.mocks.find((m) => m.date >= today)?.date ?? plan.mocks[plan.mocks.length - 1].date)}</p>
          </div>
          <Link to="/mock" className="btn-ghost shrink-0">เปิด</Link>
        </section>
      )}

      <section className="card space-y-3">
        <CardTitle icon={Clock}>เวลาเรียนวันนี้</CardTitle>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => addMinutes(-15)} disabled={minutes === 0} aria-label="ลด 15 นาที">−15</button>
          <p className="flex-1 text-center" aria-live="polite"><span className="font-display text-3xl font-bold">{minutes}</span> <span className="text-sm text-muted-fg">นาที</span></p>
          <button className="btn-ghost" onClick={() => addMinutes(15)} aria-label="เพิ่ม 15 นาที">+15</button>
          <button className="btn-ghost" onClick={() => addMinutes(30)} aria-label="เพิ่ม 30 นาที">+30</button>
        </div>
      </section>
      <p className="pb-2 text-center text-xs text-muted-fg">{plan.title}</p>
    </>
  );
}
