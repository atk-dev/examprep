# Question bank (`examprep-questions` v1.1)

A bank is a **zip**: `examprep-questions.json`, a `figures/` folder (and `audio/` if needed) and an optional `report.md`.
Import it in **ตั้งค่า → คลังข้อสอบ**. It is stored only on that device; images are shrunk to ≤1000px WebP on import.
Version 1.1 only **adds optional fields**, so every version 1 file is still valid.

> Question banks made from books are the publisher's content. Keep them out of this repository
> (`.gitignore` blocks `examprep-questions*`) and out of the published site.

```jsonc
{
  "format": "examprep-questions", "version": 1.1,
  "textFormat": "rich",                                   // 1.1: default for all text ("plain" if omitted)
  "subjects": [{ "id": "chemistry", "name": "เคมี", "color": "#7c3aed" }],   // 1.1: names for extra subjects
  "exams": [{
    "id": "prep-math-04", "title": "ข้อสอบวิชาคณิตศาสตร์ บทที่ 4 เศษส่วน", "school": "", "year": null,
    "file": "…pdf", "sessions": [], "language": "th",
    "source": { "book": "เตรียมสอบ ป.6 เข้า ม.1", "publisher": "…", "url": "", "license": "ใช้ส่วนตัว" }   // 1.1
  }],
  "passages": [{ "id": "p1", "exam": "prep-math-14", "subject": "math", "text": "…", "image": "figures/p1.png", "audio": "audio/p1.mp3" }],
  "questions": [{
    "id": "prep-math-04-001", "exam": "prep-math-04", "subject": "math", "no": 1,
    "type": "choice",                                      // choice | multi (1.1) | short | open
    "passage": null, "text": "ค่าของ $\\frac{2}{6}$ □ $\\frac{1}{8}$ ข้อใดถูก",
    "choices": [">", "<", { "text": "=" }, { "image": "figures/prep-math-04-001-c4.png" }],   // 1.1: text and/or image
    "answer": 1,                                           // multi: [1, 3]
    "solution": "…", "topic": "การเปรียบเทียบเศษส่วน",
    "image": "figures/…png", "audio": "audio/…mp3",       // audio: 1.1
    "points": 1, "tags": ["เศษส่วน", "ค.ร.น."], "page": 52,   // 1.1
    "format": "rich",                                      // 1.1: overrides textFormat for this question
    "needsReview": false, "reviewNote": ""
  }]
}
```

| Field | Notes |
|---|---|
| `subject` | Any id of letters/digits (`math`, `chemistry`, `aptitude`). `math thai science english social` get Thai names and colors automatically; give others a name in `subjects`. |
| `type` | `choice` (one answer) · `multi` (several answers, `answer: [1, 3]`) · `short` (typed answer, compared ignoring spaces/case) · `open` (written, self-graded against `solution`). |
| `answer` | 1-based choice number(s), or text for `short`. `null` = no key: the student self-grades. |
| `format: "rich"` | In `text`, choices, `solution` and passages: `**bold**`, `__underline__`, `*italic*`, `$LaTeX$` math (e.g. `$\frac{3}{4}$`, `$x^2$`, `$\sqrt{2}$`). Write `\$` for a literal dollar sign. Plain files are shown exactly as written. |
| `choices[]` | A string, or `{ "text": "…", "image": "figures/…" }` for picture choices. |
| `image`, `audio` | Paths inside the zip. Images: PNG/JPG/WebP, or SVG only if the source already has vector art (never redrawn). Audio: MP3/M4A/OGG/WAV. |
| `points`, `tags`, `page`, `source` | Shown with the question ("ที่มา: book · หน้า 52"); tags help find weak areas. |
| `needsReview` | Shows a "ตรวจกับหนังสือ" note with `reviewNote`. |

Exam ids that match a plan set id attach to that set; other exams become extra practice sets.

## Extraction prompt (for a Claude session on the computer that has the exam files)

> Read every exam and answer key in `<folder>` and convert them into a question bank for an exam-prep app.
> Output a zip named `examprep-questions.zip` containing `examprep-questions.json`, a `figures\` folder
> (plus `audio\` if there are listening files) and `report.md`, using the format `examprep-questions`
> version 1.1 described in `docs/question-format.md`. Rules:
> - Set `"textFormat": "rich"` and write formatting as `**bold**`, `__underline__`, `*italic*`; write all math
>   in LaTeX between `$…$` (fractions `$\frac{3}{4}$`, mixed numbers `$2\frac{4}{8}$`, powers `$x^2$`, roots `$\sqrt{2}$`).
>   Escape a literal dollar sign as `\$`.
> - Copy text exactly. Never guess or solve to fill in an answer: use `null` when the key doesn't give it.
> - `type`: `choice`, `multi` (answer is a list like `[1, 3]`), `short`, or `open`.
> - Picture choices: one image per choice as `{ "image": "figures/<id>-c1.png" }` (or `{ "text", "image" }`).
> - Shared passages, tables or listening clips go once in `passages`; set each question's `passage`.
> - Crop figures as PNG (≈1000px wide, white background, tight crop); use SVG only if the PDF already contains
>   the figure as vector graphics; never redraw a figure.
> - Add `page` (book page), `points` if the paper gives them, `tags`/`topic` (short Thai topic names), and the
>   book in each exam's `source`.
> - Use subject ids `math`, `thai`, `science`, `english`, `social`; for any other subject use a short English id
>   and add `{ "id", "name" }` to `subjects`.
> - Flag anything uncertain with `needsReview: true` and a short `reviewNote`.
> - Check ids are unique, JSON is valid, every image/audio path exists in the zip, and each exam's question count
>   matches the paper.
> - `report.md`: per exam, question count per subject, answers present, figures, audio, and the `needsReview` list.
