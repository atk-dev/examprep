# ตะลุยโจทย์สอบเข้า ม.1

Exam prep tracker for working through a problem book (topic summaries + ~1,600 problems) before the ม.1 entrance exam on **27 Mar 2027**. Thai UI, works offline, installable on phone/tablet. All data stays in the browser — use **ตั้งค่า → ส่งออก** to back up.

## How it plans your study
| Phase | Default dates | Focus |
|---|---|---|
| รอบแรก | start → 31 Jan | Read each topic summary, then do every problem |
| แก้จุดอ่อน | 1–28 Feb | Redo wrong problems, weak topics |
| ฝึกจับเวลา | 1–20 Mar | Mixed, timed practice |
| สัปดาห์สุดท้าย | 21–26 Mar | Light review only |

- **Daily quota** = problems left ÷ study days left in รอบแรก, recalculated every day (rest days skipped).
- **Suggestions** rotate subjects, favoring ones with more work left, lower accuracy, or not practiced lately.
- **Wrong answers come back** after 1, 3, then 7 days. Correct 3 times in a row = mastered.
- **Mistake reasons** (ไม่เข้าใจเนื้อหา / สะเพร่า / ไม่ทันเวลา / อ่านโจทย์ผิด) show where points are lost.

## Screens
- **วันนี้** – countdown, phase, today's quota, suggested topics, reviews due, study minutes
- **บันทึกโจทย์** – tap a number once = ✓, twice = ✗, then pick why
- **ทวนข้อผิด** – *ถึงกำหนด*: today's reviews · *สมุดข้อผิด*: every problem ever missed, filter by subject / reason / status, add a note with the key idea
- **ความคืบหน้า** – *รายหัวข้อ*: each topic's level · *สถิติ*: plan vs actual chart, study calendar to exam day, accuracy by subject, mistake reasons, weakest topics
- **ผู้ปกครอง** (button on วันนี้) – PIN-locked weekly summary; send to LINE as an image or text
- **ตั้งค่า** – dates, rest days, topics, PIN, backup

## Setup
1. Open the app, confirm the exam date.
2. For each subject, paste topics from the book's contents, one per line: `ชื่อหัวข้อ, จำนวนข้อ`.
3. Pick rest days. Done.

## Develop
```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (plan, review scheduling, stats, DB/backup)
npm run build    # production build in dist/
```
Pushing to `main` runs tests and deploys to GitHub Pages (enable Pages → Source: GitHub Actions in repo settings).

Stack: Vite, React, TypeScript, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa.

## Roadmap
- **M1** ✅ setup, today plan, fast problem logging, mistake review, progress, backup, PWA
- **M2** ✅ mistake notebook with filters and notes, stats charts, parent view (PIN) + shareable weekly report
- **M3** timed mixed sets for phase 3, reminders
