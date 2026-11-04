# Question bank (`examprep-questions` v1)

A bank is a **zip**: `examprep-questions.json`, a `figures/` folder and (optionally) `report.md`.
Import it in **ตั้งค่า → คลังข้อสอบ**. It is stored only on that device; figures are shrunk to ≤1000px WebP on import.

> Question banks made from books are the publisher's content. Keep them out of this repository
> (`.gitignore` blocks `examprep-questions*`) and out of the published site.

```jsonc
{
  "format": "examprep-questions", "version": 1,
  "exams": [{ "id": "prep-math-04", "title": "ข้อสอบวิชาคณิตศาสตร์ บทที่ 4 เศษส่วน", "school": "", "year": null, "file": "…pdf", "sessions": [] }],
  "passages": [{ "id": "prep-math-14-p1", "exam": "prep-math-14", "subject": "math", "text": "…", "image": "figures/prep-math-14-p1.png" }],
  "questions": [{
    "id": "prep-math-04-001", "exam": "prep-math-04", "subject": "math", "no": 1, "type": "choice",
    "passage": null, "text": "…", "choices": ["…", "…", "…", "…"], "answer": 1,
    "solution": "…", "topic": "การเปรียบเทียบเศษส่วน", "image": "figures/…png",
    "needsReview": false, "reviewNote": ""
  }]
}
```

- `exam` ids that match a plan set id attach to that set; other exams become extra practice sets.
- `answer`: 1-based choice number for `choice`; exact text for `short`; `null` if unknown (then self-graded). `open` is self-graded against `solution`.
- `needsReview: true` shows a "ตรวจกับหนังสือ" note on the question.
- Figures: PNG/JPG/WebP crops, or SVG only when the source already has vector figures. Never redraw.

## Extraction prompt (for a Claude session on the computer that has the exam files)

> Read every exam and answer key in `<folder>` and convert them into a question bank. Output a zip named
> `examprep-questions.zip` containing `examprep-questions.json`, a `figures\` folder and `report.md`, using the
> format in `docs/question-format.md`. Rules: copy text exactly; never guess or solve to fill in an answer
> (use `null`); put shared passages/tables once in `passages`; crop figures as PNG (≈1000px wide, white background)
> or export SVG only if the PDF already contains vector graphics — never redraw; flag anything uncertain with
> `needsReview` + `reviewNote`; check ids are unique, JSON is valid, every image path exists, and question counts
> match the paper. `report.md`: per exam, question count per subject, answers present, figures, and the
> `needsReview` list.
