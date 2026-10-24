# Prompt: PTS Live Seed + Chapter-Scoped Question Types (Class 9 pattern)

Copy everything below the line into a new Cursor chat when you want the same work for another class (e.g. Class 10) or to re-run / extend Class 9.

---

## GOAL

Build / extend a **read-only live PTS → Mongo Gen\* question bank** for **Punjab Textbook (PTB)** and wire the **Test Generator UI** so question types match **PTS Generate Paper**:

1. Pull syllabus + questions from `https://www.paktestsolution.com` (read-only APIs only).
2. Store under `backend/data/lahore-board/{classFolder}/` and upsert into GenBoard / GenClass / GenSubject / GenChapter / GenTopic / GenQuestion.
3. UI must show **PTS question-type names** and only types that exist for the **currently selected chapter(s)** — not the full subject list.

**Hard rules**

- READ-ONLY PTS: `GetSyllabus`, `SubjectsList`, `ChaptersList`, `GetQuestions` (AjaxCalling).
- NEVER call `SavePaper` / `CreatePaper` or any write/save paper API.
- Auth: `PTS_USER`+`PTS_PASS` or `PTS_COOKIE` (full Cookie header from logged-in browser).
- Do not invent question types; use PTS subtype IDs + field codes from an existing working seed when possible.

---

## REFERENCE IMPLEMENTATION (already done for Class 9)

Use these as the source of truth and clone/adapt for the target class:

| Piece | Path |
|--------|------|
| Live seed script | `backend/src/scripts/seedPtsLiveClass9.js` |
| Optional ingest | `backend/src/scripts/seedPtsLiveClass9Ingest.js` |
| JSON dump root | `backend/data/lahore-board/9th/` |
| Per-subject files | `{slug}/syllabus.json`, `all-questions.json`, `pts-raw/hierarchy.json` |
| Seed summary | `backend/data/lahore-board/9th/_live-seed-summary.json` |
| Gen models | `backend/src/models/generator/Gen*.js` |
| Syllabus + pool API | `backend/src/controllers/generatorController.js` |
| UI wizard | `frontend/src/pages/GeneratorCreate.jsx` |
| PTS type catalogs + chapter filter | `frontend/src/utils/generatorQuestionTypes.js` |
| Compare system labels (names/order) | `_compare_Test_System/src/app/teacher/generate/english-fields.ts` |

Class 9 constants in seed:

- Board: `Punjab Textbook`
- Class: `Class 9` / PTS class id `9`
- Data root: `backend/data/lahore-board/9th`
- Priorities: `[1,2,3,4,5]`
- Topic chunk / mongo chunk: `8` / `400`

---

## PART A — LIVE SEED (questions + chapters + types)

### A1. Subject config (PTS SubjectID → slug + question subtypes)

For each subject, define:

```js
{
  slug: "english",
  types: [
    { id: <PTS QuestionSubTypeID>, name: "mcq-spelling", bankType: "mcq"|"short"|"long", field: "SPELLING" },
    // ...
  ]
}
```

- `bankType` maps to GenQuestion `type`: MCQ | SHORT | LONG
- `field` maps to GenQuestion `subType` (uppercase field code)
- Science-style subjects usually only: `MCQ` / `QA` / `LONG` (subtype ids 1 / 12 / 13)
- Language / Islamiyat / Tarjuma have **many** subtypes (spelling, voice, hadith, ayat, etc.)

Class 9 multi-type subjects that need special catalogs:

- English, Urdu Compulsory, Islamiyat Compulsory, Islamiyat Elective, Tarjuma Quran, Punjabi

### A2. Fetch flow (per subject)

1. Login / cookie session.
2. Resolve board + class on PTS.
3. List chapters → topics (hierarchy).
4. For each configured `QuestionSubTypeID` × priority, call `GetQuestions` with topic id chunks.
5. Normalize each question:
   - `type` = bankType upper
   - `subType` / `field` = field code
   - `source` from PTS priority / field helper (Exercise, Tick correct spelling, etc.)
   - stable `externalKey` for upsert
6. Write:
   - `syllabus.json` (chapters + topics)
   - `all-questions.json`
   - `pts-raw/*`
7. Upsert Mongo Gen\* tree + questions.
8. Append subject summary to `_live-seed-summary.json` with `counts`, `fieldCounts`, mongo created/updated.

### A3. After seed — verify chapter × question-type matrix

For every multi-type subject, compute from `all-questions.json`:

- Per chapter: which `(type, field/subType)` exist and counts
- Subject-wide: full field list

**Critical finding (must preserve in UI):**  
PTS shows types for the **selected chapter only**. Example: English Chapter 6 → **6** types; full English subject → **11** types with data. If UI uses subject-wide list, users see extra types (e.g. 8) that return 0 questions for that chapter.

Also note empty chapters (e.g. English “English B” may have 0 questions in bank even if topics exist).

---

## PART B — BACKEND API (support chapter-scoped types)

In `GET /generator/subjects/:subjectId/syllabus`:

1. Aggregate questions by `{ topic, type, subType }`.
2. Return:
   - `questionTypes`: subject-wide `[{ type, subType, count }]`
   - each topic: `countsByType`, `countsBySubType`, **`questionTypes`** (per-topic type+subType+count)

In `POST /generator/pool/search` and `/pool/pick`:

- Accept `type`, optional `subType`, optional `subTypes[]` (aliases e.g. PAIR ↔ WORD for Tarjuma).
- Filter by selected `topicIds` / `chapterIds`.

---

## PART C — FRONTEND UI (PTS names + selected-chapter filter)

### C1. Catalogs with exact PTS labels

Maintain catalogs in `frontend/src/utils/generatorQuestionTypes.js` aligned with `_compare_Test_System/.../english-fields.ts`:

- Class 9 English (Spelling, Meaning, Verb, Grammar, QA, Voice, Translate EN/UR, Idioms, Poem Stanzas, …)
- Urdu Lazmi
- Islamiyat Lazmi (+ Hadith, Personality)
- Islamiyat Elective (+ Ayat) — detect “اختیاری” / elective separately from compulsory
- Tarjuma (PAIR catalog field ↔ DB `WORD`)
- Punjabi (MCQ, QA, Meaning, Word, Idiom, Poem, Summary, Passage)

### C2. Build picker options from **selection**, not full subject

```text
selectionQuestionTypes = sum counts from selected topicIds only
pickerOptions = buildPtsPickerOptions({
  subjectName,
  className,
  questionTypes: selectedTopicIds.length ? selectionQuestionTypes : subjectQuestionTypes
})
// filter catalog entries to count > 0
// labels = PTS catalog labels (never raw SPELLING-only codes in UI)
```

When selection changes and active type is no longer available → switch to first available type; clear pool.

### C3. Syllabus chips

Show the same chapter-scoped PTS type list + counts above the chapter grid.

### C4. Search / Random

Pass `type` + `subTypes` aliases; only questions in selected topics.

---

## PART D — ACCEPTANCE CHECKS

For target class, pick multi-type subjects and verify:

1. **Single chapter** (e.g. English Ch6): type count and names match PTS for that chapter.
2. **All chapters**: type menu grows to subject-wide types that have data.
3. Selecting a type with 0 questions in that chapter must not appear (or must not be selectable).
4. Basic subjects (Bio/Chem/Physics): still show MCQ / Short / Long only; no regression.
5. Seed summary totals ≈ Mongo counts; no SavePaper usage.

Suggested offline check script pattern:

```js
// For each subject slug: group all-questions.json by chapterNumber → field/subType counts
// Compare UI pickerOptions length for that chapter selection to PTS
```

---

## PART E — HOW TO RUN (Class 9 reference)

```bash
cd backend
# .env: PTS_USER+PTS_PASS or PTS_COOKIE, MONGO URI
node src/scripts/seedPtsLiveClass9.js              # all Class 9 subjects
node src/scripts/seedPtsLiveClass9.js english      # one subject
```

Then restart API + frontend; open Academy → Generator → Class 9 → subject → select chapter(s) → confirm type chips / picker match PTS.

---

## WHEN ADAPTING TO CLASS 10 (or another class)

1. Clone `seedPtsLiveClass9.js` → `seedPtsLiveClass10.js` (or generalize class id / folder).
2. Change `CLASS_ID`, `CLASS_NAME`, `DATA_ROOT` (`10th`), PTS subject IDs if different.
3. Re-discover / copy `SUBJECT_CONFIG` subtype IDs from PTS for that class (do not assume Class 9 IDs).
4. Reuse UI catalogs; extend if Class 10 has new fields (check compare `english-fields.ts`).
5. Keep **chapter-scoped picker** logic — do not revert to subject-wide-only menus for multi-type subjects.
6. Never enable PTS write/save paper endpoints.

---

## OUTPUT EXPECTED FROM THE AGENT

1. Working seed script + JSON dumps + Mongo upsert.
2. `_live-seed-summary.json` (or class equivalent) with per-subject fieldCounts.
3. Syllabus API returns per-topic `questionTypes`.
4. Generator UI: PTS names + types filtered by selected chapters.
5. Short verification table: for English/Urdu/Islamiyat/Tarjuma (and Punjabi), one sample chapter’s type count vs all-chapters type count.

---
