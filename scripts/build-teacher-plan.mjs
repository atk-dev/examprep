// Builds public/plans/teacher-m1-2570.json from the teacher's paper calendar
// "ปฏิทินเตรียมสอบเข้า ม.1" (โรงเรียนปากช่อง). Tables below are transcribed from the PDF
// (checklist page + month calendars). Run: node scripts/build-teacher-plan.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../public/plans/teacher-m1-2570.json', import.meta.url));

// Exam order and colors (colors = the app's validated subject palette).
const subjects = [
  { id: 'thai', name: 'ภาษาไทย', color: '#0891b2' },
  { id: 'math', name: 'คณิตศาสตร์', color: '#4f46e5' },
  { id: 'science', name: 'วิทยาศาสตร์', color: '#059669' },
  { id: 'english', name: 'ภาษาอังกฤษ', color: '#d97706' },
  { id: 'social', name: 'สังคมศึกษา', color: '#db2777' },
];
const prefix = { math: 'prep-math', thai: 'prep-thai', science: 'prep-sci', english: 'prep-eng', social: 'prep-soc' };

// Chapters: [name, problem count]. Set ids match the question bank's exam ids (prep-math-01 ...).
const chapters = {
  math: [
    ['จำนวนนับที่มากกว่า 100,000', 15], ['การบวก ลบ คูณ หารจำนวนนับ', 15],
    ['ตัวประกอบของจำนวนนับ ห.ร.ม. และ ค.ร.น.', 15], ['เศษส่วน', 15], ['ทศนิยม', 15],
    ['สมการ และการแก้สมการ', 15], ['การวัด', 10], ['เวลา', 10], ['เงิน', 10],
    ['รูปเรขาคณิตและรูปทรงสามมิติ', 15], ['พื้นที่', 15], ['ปริมาตร', 15], ['เส้นขนาน', 15],
    ['สถิติและความน่าจะเป็น', 15], ['บทประยุกต์', 15],
  ],
  thai: [['หลักภาษาไทย', 30], ['ภาษาพาที และวรรณคดีลำนำ', 10]],
  science: [
    ['อาหารและสารอาหาร', 20], ['ร่างกายมนุษย์และสัตว์', 20], ['พืช', 20], ['สิ่งมีชีวิตกับสิ่งแวดล้อม', 10],
    ['สารในชีวิตประจำวัน', 20], ['ไฟฟ้า', 20], ['ดินและหิน', 10], ['ระบบสุริยะ', 20],
    ['แรงและการเคลื่อนที่', 20], ['พลังงานและความร้อน', 10], ['เสียงกับการได้ยิน', 10],
  ],
  english: [
    ['Tense', 80], ['การสนทนา (Conversation)', 30], ['การอ่าน (Reading)', 30],
    ['คำศัพท์ที่ออกข้อสอบบ่อย (Vocabulary)', 30], ['เบ็ดเตล็ด', 20],
  ],
  social: [
    ['ศาสนา', 20], ['การปกครอง และวัฒนธรรม', 20], ['เศรษฐศาสตร์', 20],
    ['ประวัติศาสตร์', 20], ['ภูมิศาสตร์', 20], ['อาเซียนศึกษา', 20],
  ],
};

// Chapter days: [date, subject, chapter no, from, to]
const chapterDays = [
  ['2026-11-09', 'math', 1], ['2026-11-16', 'math', 2], ['2026-11-23', 'math', 3], ['2026-11-30', 'math', 4],
  ['2026-12-07', 'math', 5], ['2026-12-14', 'math', 6], ['2026-12-21', 'math', 7], ['2026-12-28', 'math', 8],
  ['2027-01-04', 'math', 9], ['2027-01-08', 'math', 10], ['2027-01-13', 'math', 11], ['2027-01-18', 'math', 12],
  ['2027-01-19', 'math', 13], ['2027-01-20', 'math', 14], ['2027-01-21', 'math', 15],
  ['2026-11-10', 'thai', 1, 1, 10], ['2026-11-17', 'thai', 1, 11, 20], ['2026-11-24', 'thai', 1, 21, 30], ['2026-12-01', 'thai', 2],
  ['2026-11-11', 'social', 1], ['2026-11-18', 'social', 2], ['2026-11-25', 'social', 3], ['2026-12-02', 'social', 4],
  ['2026-12-09', 'social', 5], ['2026-12-16', 'social', 6],
  ['2026-11-12', 'science', 1], ['2026-11-19', 'science', 2], ['2026-11-26', 'science', 3], ['2026-12-03', 'science', 4],
  ['2026-12-10', 'science', 5], ['2026-12-17', 'science', 6], ['2026-12-24', 'science', 7], ['2026-12-31', 'science', 8],
  ['2027-01-05', 'science', 9], ['2027-01-11', 'science', 10], ['2027-01-14', 'science', 11],
  ['2026-11-13', 'english', 1, 1, 20], ['2026-11-20', 'english', 1, 21, 40], ['2026-11-27', 'english', 1, 41, 60],
  ['2026-12-04', 'english', 1, 61, 80], ['2026-12-11', 'english', 2, 1, 15], ['2026-12-18', 'english', 2, 16, 30],
  ['2026-12-25', 'english', 3, 1, 15], ['2027-01-01', 'english', 3, 16, 30], ['2027-01-07', 'english', 4, 1, 15],
  ['2027-01-12', 'english', 4, 16, 30], ['2027-01-15', 'english', 5],
];

// Pretests: size, minutes for the timed part, the timed range end, and [full day, review day] per set.
const pretest = {
  math: { size: 50, minutes: 60, timedTo: 40, days: [['2027-01-25', '2027-01-26'], ['2027-02-08', '2027-02-09'], ['2027-02-22', '2027-02-23']] },
  thai: { size: 40, minutes: 40, timedTo: 40, days: [['2027-01-27', '2027-01-28'], ['2027-02-10', '2027-02-11']] },
  social: { size: 30, minutes: 30, timedTo: 30, days: [['2027-01-29', '2027-02-01'], ['2027-02-12', '2027-02-15'], ['2027-02-24', '2027-02-25']] },
  science: { size: 50, minutes: 40, timedTo: 40, days: [['2027-02-02', '2027-02-03'], ['2027-02-16', '2027-02-17'], ['2027-02-26', '2027-03-01']] },
  english: { size: 50, minutes: 60, timedTo: 40, days: [['2027-02-04', '2027-02-05'], ['2027-02-18', '2027-02-19']] },
};

const thaiReview = 'หลักภาษาไทย · ภาษาพาที · วรรณคดีลำนำ';
const thaiSets = ['prep-thai-01', 'prep-thai-02'];
// [date, subject, title, note, chapter sets it reviews]
const subjectReviewDays = [
  ['2026-12-08', 'thai', 'ทวนบทที่จบแล้ว', thaiReview, thaiSets], ['2026-12-15', 'thai', 'ทวนบทที่จบแล้ว', thaiReview, thaiSets],
  ['2026-12-22', 'thai', 'ทวนบทที่จบแล้ว', thaiReview, thaiSets], ['2026-12-29', 'thai', 'ทวนบทที่จบแล้ว', thaiReview, thaiSets],
  ['2026-12-23', 'social', 'ทวนบท 1–2', 'ศาสนา · การปกครองและวัฒนธรรม', ['prep-soc-01', 'prep-soc-02']],
  ['2026-12-30', 'social', 'ทวนบท 3–4', 'เศรษฐศาสตร์ · ประวัติศาสตร์', ['prep-soc-03', 'prep-soc-04']],
  ['2027-01-06', 'social', 'ทวนบท 5–6', 'ภูมิศาสตร์ · อาเซียนศึกษา', ['prep-soc-05', 'prep-soc-06']],
];

const mocks = [
  { n: 1, date: '2027-02-06', note: 'ใช้เป็นตัววัด · ข้อสอบเก่า / แหล่งอื่น' },
  { n: 2, date: '2027-02-20', note: 'ข้อสอบเก่า / แหล่งอื่น' },
  { n: 3, date: '2027-03-06', note: 'ข้อสอบเก่า / แหล่งอื่น' },
  { n: 4, date: '2027-03-13', note: 'คณิต 4 · วิทย์ 4 · อังกฤษ 3' },
  { n: 5, date: '2027-03-20', note: 'คณิต 5 · วิทย์ 5 · ไทย 3' },
];

// Phase 3 (2–26 มี.ค.): one subject per weekday.
const reviewByWeekday = { 1: 'math', 2: 'thai', 3: 'social', 4: 'science', 5: 'english' };

// ---------- build ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const weekday = (s) => parse(s).getUTCDay();

const sets = [];
for (const [subject, list] of Object.entries(chapters)) {
  list.forEach(([name, count], i) => sets.push({ id: `${prefix[subject]}-${pad(i + 1)}`, subject, kind: 'chapter', name: `บทที่ ${i + 1} ${name}`, count }));
}
for (const [subject, p] of Object.entries(pretest)) {
  p.days.forEach((_, i) => sets.push({ id: `pretest-${subject}-${i + 1}`, subject, kind: 'pretest', name: `Pretest ชุดที่ ${i + 1}`, count: p.size }));
}

const tasks = [];
const timerFrom = '2026-12-01'; // the calendar adds a time limit from December
const rate = (subject) => (subject === 'math' || subject === 'english' ? 1.5 : 1);

for (const [date, subject, no, from0, to0] of chapterDays) {
  const set = sets.find((s) => s.id === `${prefix[subject]}-${pad(no)}`);
  const from = from0 ?? 1;
  const to = to0 ?? set.count;
  const n = to - from + 1;
  const split = from0 ? ` · ข้อ ${from}–${to}` : '';
  tasks.push({
    date, type: 'practice', subject, set: set.id, from, to,
    minutes: date >= timerFrom ? Math.ceil(n * rate(subject)) : null,
    title: `${set.name}${split} · ${n} ข้อ`,
  });
}
for (const [subject, p] of Object.entries(pretest)) {
  p.days.forEach(([full, review], i) => {
    const set = `pretest-${subject}-${i + 1}`;
    tasks.push({ date: full, type: 'timed', subject, set, from: 1, to: p.timedTo, minutes: p.minutes,
      title: `Pretest ชุดที่ ${i + 1} · ทำข้อ 1–${p.timedTo} รวดเดียว จับเวลา ${p.minutes} นาที` });
    const extra = p.size > p.timedTo;
    tasks.push({ date: review, type: 'reviewWrong', subject, set, ...(extra ? { from: p.timedTo + 1, to: p.size } : {}),
      title: `Pretest ชุดที่ ${i + 1} · ไล่ข้อที่ผิด${extra ? ` แล้วทำข้อ ${p.timedTo + 1}–${p.size}` : ''}` });
  });
}
// `sets` without ranges are references (shown on the card); they don't auto-complete the task.
for (const [date, subject, title, note, refs] of subjectReviewDays) tasks.push({ date, type: 'subjectReview', subject, title, note, sets: refs.map((set) => ({ set })) });
tasks.push({ date: '2027-01-22', type: 'catchup', title: 'วันเก็บตก', note: 'ทำโจทย์ที่ค้าง หรือพัก' });
for (let d = '2027-03-02'; d <= '2027-03-26'; d = addDays(d, 1)) {
  const subject = reviewByWeekday[weekday(d)];
  if (subject) tasks.push({ date: d, type: 'subjectReview', subject, title: 'ทวนเรื่องที่ยังอ่อน', note: 'ตามตาราง + ข้อที่ผิด' });
}
tasks.push({ date: '2026-11-07', type: 'kickoff', title: 'ชี้แจงข้อตกลงและวิธีทำโจทย์', note: '1 ชม.' });
const mockDates = new Set(mocks.map((m) => m.date));
for (let d = '2026-11-14'; d <= '2027-03-20'; d = addDays(d, 7)) {
  if (!mockDates.has(d)) tasks.push({ date: d, type: 'saturday', title: 'ทวนสะสม + ถามข้อสงสัย', note: '1 ชม. (ทวน 15′ · ถาม 45′)' });
}
for (const m of mocks) tasks.push({ date: m.date, type: 'mock', title: `สอบจำลองครั้งที่ ${m.n}`, note: m.note, mock: m.n });
tasks.push({ date: '2027-03-27', type: 'exam', title: 'วันสอบ' });

tasks.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
tasks.forEach((t) => { t.id = `${t.date}-${t.type}${t.set ? `-${t.set}` : t.subject ? `-${t.subject}` : ''}${t.from ? `-${t.from}` : ''}`; });

const plan = {
  format: 'examprep-plan',
  version: 1.1,
  title: 'ปฏิทินเตรียมสอบเข้า ม.1',
  description: 'วันละวิชา วันละ 30 นาที · เสาร์ทวนสะสมและถามข้อสงสัย 1 ชั่วโมง · อาทิตย์พัก',
  profile: { school: 'โรงเรียนปากช่อง', studentName: '', teacherName: '', targetScore: null },
  exam: {
    name: 'สอบเข้า ม.1', date: '2027-03-27', totalScore: 200,
    note: 'ลำดับและเวลาตามตารางสอบจริง 2 ปีล่าสุด · ยืนยันวันสอบกับประกาศโรงเรียนอีกครั้ง',
    sessions: [
      { subject: 'thai', start: '09:00', minutes: 40, questions: 40 },
      { subject: 'math', start: '09:50', minutes: 60, questions: 40 },
      { subject: 'science', start: '11:00', minutes: 40, questions: 40 },
      { subject: 'english', start: '13:00', minutes: 60, questions: 40 },
      { subject: 'social', start: '14:10', minutes: 40, questions: 40 },
    ],
  },
  subjects,
  phases: [
    { id: 'chapters', name: 'โจทย์ท้ายบท', start: '2026-11-09', end: '2027-01-21', goal: 'ทำโจทย์ท้ายบทวันละวิชา ครบ 39 บท' },
    { id: 'pretest', name: 'Pretest', start: '2027-01-25', end: '2027-03-01', goal: 'ทำ Pretest 13 ชุด วันเว้นวัน: วันแรกจับเวลา วันถัดไปไล่ข้อที่ผิด' },
    { id: 'review', name: 'ทบทวนก่อนสอบ', start: '2027-03-02', end: '2027-03-26', goal: 'ทวนเรื่องที่ยังอ่อนตามตาราง + ข้อที่ผิด' },
  ],
  restWeekdays: [0],
  sets,
  tasks,
  mocks,
};
writeFileSync(out, JSON.stringify(plan, null, 1) + '\n');
console.log(`wrote ${out}: ${sets.length} sets, ${tasks.length} tasks`);
