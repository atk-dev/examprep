import type { ExamDB } from '../db/db';
import type { Settings, Subject, Topic } from '../types';
import { addDaysISO } from '../logic/dates';
import { defaultPhases } from '../logic/plan';
import type { PlanFile } from './planSchema';

/** Learning-data tables wiped when a plan is applied (the question bank is kept). */
const resetTables = (db: ExamDB) => [
  db.subjects, db.topics, db.attempts, db.problemStates, db.problemNotes, db.mockSets, db.dailyLogs, db.taskDone, db.mockExams, db.plan,
];

/**
 * Replace the study setup with an imported plan: subjects, one topic per set, exam info,
 * phases, rest days and profile. Existing practice history is cleared (callers offer a
 * backup first). Questions already imported attach again through set keys.
 */
export async function applyPlan(db: ExamDB, plan: PlanFile, prev?: Settings) {
  const ph = plan.phases;
  const fallback = defaultPhases(plan.exam.date);
  const settings: Settings = {
    id: 'main',
    examName: plan.exam.name,
    examDate: plan.exam.date,
    startDate: ph[0]?.start ?? plan.tasks.map((t) => t.date).sort()[0],
    phase1End: ph[0]?.end ?? fallback.phase1End,
    phase2End: ph[1]?.end ?? fallback.phase2End,
    phase3End: ph[2]?.end ?? fallback.phase3End,
    restWeekdays: plan.restWeekdays,
    parentPin: prev?.parentPin ?? '',
    setupDone: prev?.setupDone ?? false,
    reminderTime: prev?.reminderTime,
    lastBackupAt: prev?.lastBackupAt,
    mockMinutesPerProblem: prev?.mockMinutesPerProblem,
    planMode: 'plan',
    phaseLabels: ph.map((p) => ({ name: p.name, goal: p.goal })),
    profile: {
      school: plan.profile?.school || prev?.profile?.school || '',
      studentName: prev?.profile?.studentName || plan.profile?.studentName || '',
      teacherName: prev?.profile?.teacherName || plan.profile?.teacherName || '',
      targetScore: prev?.profile?.targetScore ?? plan.profile?.targetScore ?? null,
    },
  };
  // Phase ends must stay ordered for the settings form; nudge if a plan has fewer phases.
  if (settings.phase2End <= settings.phase1End) settings.phase2End = addDaysISO(settings.phase1End, 1);
  if (settings.phase3End <= settings.phase2End) settings.phase3End = addDaysISO(settings.phase2End, 1);
  if (settings.phase3End >= settings.examDate) settings.phase3End = addDaysISO(settings.examDate, -1);

  await db.transaction('rw', [...resetTables(db), db.settings], async () => {
    await Promise.all(resetTables(db).map((t) => t.clear()));
    const subjectIds = new Map<string, number>();
    for (const [order, s] of plan.subjects.entries()) {
      const row: Subject = { key: s.id, name: s.name, color: s.color, order };
      subjectIds.set(s.id, await db.subjects.add(row));
    }
    const topics: Topic[] = plan.sets.map((set, order) => ({
      subjectId: subjectIds.get(set.subject)!,
      key: set.id,
      kind: set.kind,
      name: set.name,
      order,
      problemCount: set.count,
      summaryRead: false,
    }));
    await db.topics.bulkAdd(topics);
    await db.plan.put({ id: 'main', importedAt: Date.now(), plan });
    await db.settings.put(settings);
  });
}

/** Load the plan that ships with the app. */
export async function fetchBundledPlan(): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}plans/teacher-m1-2570.json`);
  if (!res.ok) throw new Error('โหลดแผนไม่สำเร็จ');
  return res.json();
}
