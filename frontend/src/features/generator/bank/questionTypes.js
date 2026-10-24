/**
 * PTS Generate-Paper question-type catalogs + labels.
 * Keep names/order aligned with `_compare_Test_System` english-fields.ts.
 */

import { TYPE_GROUP_LABELS } from "../utils/paperBlueprint.js";

/** @typedef {'MCQ'|'SHORT'|'LONG'} QType */
/** @typedef {{ type: QType, field: string, label: string, value: string }} PtsTypeOption */

export { TYPE_GROUP_LABELS };

/** DB subType aliases → catalog field (and reverse for queries). */
/** Catalog field → DB subType values to match when searching / counting */
const FIELD_ALIASES = {
  // Tarjuma catalog uses PAIR; seed stores WORD
  PAIR: ["PAIR", "WORD"],
  WORD: ["WORD", "PAIR"],
  // Inter / some seeds store generic MCQ under COMPREHENSION slot
  COMPREHENSION: ["COMPREHENSION", "MCQ"],
  MCQ: ["MCQ", "COMPREHENSION"],
};

/** Primary English (PTS ONE–8TH) — PTS subtype names (do not merge IDs). */
export const PRIMARY_ENGLISH_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "COMPREHENSION", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:COMPREHENSION" },
  { type: "MCQ", field: "SPELLING", label: "Tick Correct Spelling", value: "MCQ:SPELLING" },
  { type: "MCQ", field: "MEANING", label: "Correct Meaning Of Underlined Word", value: "MCQ:MEANING" },
  { type: "MCQ", field: "GRAMMAR", label: "Tick Correct According To Grammar", value: "MCQ:GRAMMAR" },
  { type: "SHORT", field: "FILL", label: "Fill in the blanks", value: "SHORT:FILL" },
  { type: "SHORT", field: "TRUE_FALSE", label: "True / False", value: "SHORT:TRUE_FALSE" },
  { type: "SHORT", field: "ARRANGE", label: "Arrange the letters / words", value: "SHORT:ARRANGE" },
  { type: "SHORT", field: "TRACE", label: "Trace the given line", value: "SHORT:TRACE" },
  { type: "SHORT", field: "WORD", label: "Words Into Sentences (الفاظ کو جملوں میں استعمال)", value: "SHORT:WORD" },
  { type: "SHORT", field: "USE_SENTENCE", label: "Use in your own sentences", value: "SHORT:USE_SENTENCE" },
  { type: "SHORT", field: "VOCAB", label: "Vocabulary / Name the following", value: "SHORT:VOCAB" },
  { type: "SHORT", field: "GENDER", label: "Gender", value: "SHORT:GENDER" },
  { type: "SHORT", field: "MISSING_LETTERS", label: "Fill in the missing letters", value: "SHORT:MISSING_LETTERS" },
  { type: "SHORT", field: "RHYME", label: "Rhyming words", value: "SHORT:RHYME" },
  { type: "LONG", field: "LETTER", label: "Letters (خطوط)", value: "LONG:LETTER" },
  { type: "LONG", field: "APPLICATION", label: "Applications (درخواستیں)", value: "LONG:APPLICATION" },
  { type: "LONG", field: "STORY", label: "Stories (کہانیاں)", value: "LONG:STORY" },
  { type: "LONG", field: "ESSAY", label: "Essays (مضامین)", value: "LONG:ESSAY" },
  { type: "LONG", field: "TRANSLATE_UR", label: "Translate Into Urdu Paragraphs", value: "LONG:TRANSLATE_UR" },
];

/** Primary Urdu (PTS ONE–8TH) — PTS names (Urdu script where PTS uses it). */
export const PRIMARY_URDU_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "FILL", label: "خالی جگہ پُر کیجیے", value: "SHORT:FILL" },
  { type: "SHORT", field: "TRUE_FALSE", label: "درست / غلط", value: "SHORT:TRUE_FALSE" },
  { type: "SHORT", field: "ARRANGE", label: "الفاظ کو ترتیب دیجیے", value: "SHORT:ARRANGE" },
  { type: "SHORT", field: "QA", label: "سوالات جوابات", value: "SHORT:QA" },
  { type: "SHORT", field: "WORD", label: "الفاظ کو جملوں میں استعمال", value: "SHORT:WORD" },
  { type: "SHORT", field: "USE_SENTENCE", label: "اپنے جملے بنائیے", value: "SHORT:USE_SENTENCE" },
  { type: "SHORT", field: "VOCAB", label: "الفاظ / نام", value: "SHORT:VOCAB" },
  { type: "SHORT", field: "GENDER", label: "Gender", value: "SHORT:GENDER" },
  { type: "SHORT", field: "IDIOM", label: "محاورات", value: "SHORT:IDIOM" },
  { type: "LONG", field: "PASSAGE", label: "پیراگراف", value: "LONG:PASSAGE" },
  { type: "LONG", field: "LONG", label: "تفصیلی سوالات", value: "LONG:LONG" },
];

/** Class 9 English — exact PTS Generate Paper order/names. */
/** Exact PTS Class 9 English All-Topics dropdown (15) — order + labels match live PTS. */
export const CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "SPELLING", label: "Tick Correct Spelling", value: "MCQ:SPELLING" },
  { type: "MCQ", field: "MEANING", label: "Correct Meaning Of Underlined Word", value: "MCQ:MEANING" },
  { type: "MCQ", field: "VERB", label: "Tick Correct Form Of Verb", value: "MCQ:VERB" },
  { type: "MCQ", field: "GRAMMAR", label: "Tick Correct According To Grammar", value: "MCQ:GRAMMAR" },
  { type: "SHORT", field: "QA", label: "Question Answers (سوالات جوابات)", value: "SHORT:QA" },
  { type: "LONG", field: "LETTER", label: "Letters (خطوط)", value: "LONG:LETTER" },
  { type: "SHORT", field: "TRANSLATE_EN", label: "Translate Into English Sentences", value: "SHORT:TRANSLATE_EN" },
  { type: "SHORT", field: "VOICE", label: "Active & Passive Voice", value: "SHORT:VOICE" },
  { type: "LONG", field: "STORY", label: "Stories (کہانیاں)", value: "LONG:STORY" },
  { type: "LONG", field: "SUMMARY", label: "Summary (خلاصہ) Matric", value: "LONG:SUMMARY" },
  { type: "LONG", field: "DIALOGUE", label: "Dialogues (مکالمے)", value: "LONG:DIALOGUE" },
  { type: "SHORT", field: "IDIOM", label: "Idioms", value: "SHORT:IDIOM" },
  { type: "LONG", field: "TRANSLATE_UR", label: "Translate Into Urdu Paragraphs", value: "LONG:TRANSLATE_UR" },
  { type: "LONG", field: "PASSAGE", label: "Comprehension Paragraphs (تفہیم عبارات)", value: "LONG:PASSAGE" },
  { type: "LONG", field: "POEM_STANZA", label: "Poems Stanzas", value: "LONG:POEM_STANZA" },
];

/**
 * Exact PTS Class 10 English All-Topics dropdown (12) — order + labels match live PTS
 * (ClassID=10&SubjectID=64, all chapters selected).
 */
export const CLASS10_ENGLISH_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "SPELLING", label: "Tick Correct Spelling", value: "MCQ:SPELLING" },
  { type: "MCQ", field: "MEANING", label: "Correct Meaning Of Underlined Word", value: "MCQ:MEANING" },
  { type: "MCQ", field: "VERB", label: "Tick Correct Form Of Verb", value: "MCQ:VERB" },
  { type: "MCQ", field: "GRAMMAR", label: "Tick Correct According To Grammar", value: "MCQ:GRAMMAR" },
  { type: "SHORT", field: "QA", label: "Question Answers (سوالات جوابات)", value: "SHORT:QA" },
  { type: "SHORT", field: "DI", label: "Direct & Indirect", value: "SHORT:DI" },
  { type: "LONG", field: "ESSAYS", label: "Essays (مضامین)", value: "LONG:ESSAYS" },
  { type: "LONG", field: "SUMMARY", label: "Summary (خلاصہ) Matric", value: "LONG:SUMMARY" },
  { type: "SHORT", field: "PAIR", label: "Pair Of Words", value: "SHORT:PAIR" },
  { type: "LONG", field: "TRANSLATE_UR", label: "Translate Into Urdu Paragraphs", value: "LONG:TRANSLATE_UR" },
  { type: "LONG", field: "TRANSLATE_EN", label: "Translate Into English Paragraphs", value: "LONG:TRANSLATE_EN" },
  { type: "LONG", field: "POEM_STANZA", label: "Poems Stanzas", value: "LONG:POEM_STANZA" },
];

/** Inter English — PTS-style names (fixed order; empty bank types stay hidden). */
export const SECONDARY_ENGLISH_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "COMPREHENSION", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:COMPREHENSION" },
  { type: "MCQ", field: "SPELLING", label: "Tick Correct Spelling", value: "MCQ:SPELLING" },
  { type: "MCQ", field: "MEANING", label: "Correct Meaning Of Underlined Word", value: "MCQ:MEANING" },
  { type: "MCQ", field: "SYNONYM", label: "Tick Cross Synonyms / Antonyms", value: "MCQ:SYNONYM" },
  { type: "MCQ", field: "VERB", label: "Tick Correct Form Of Verb", value: "MCQ:VERB" },
  { type: "MCQ", field: "GRAMMAR", label: "Tick Correct According To Grammar", value: "MCQ:GRAMMAR" },
  { type: "SHORT", field: "QA", label: "Question Answers (سوالات جوابات)", value: "SHORT:QA" },
  { type: "LONG", field: "LETTER", label: "Letters (خطوط)", value: "LONG:LETTER" },
  { type: "SHORT", field: "TRANSLATE_EN", label: "Translate Into English Sentences", value: "SHORT:TRANSLATE_EN" },
  { type: "SHORT", field: "DI", label: "Direct & Indirect", value: "SHORT:DI" },
  { type: "SHORT", field: "VOICE", label: "Active & Passive Voice", value: "SHORT:VOICE" },
  { type: "LONG", field: "STORY", label: "Stories (کہانیاں)", value: "LONG:STORY" },
  { type: "LONG", field: "SUMMARY", label: "Summary (خلاصہ) Matric", value: "LONG:SUMMARY" },
  { type: "LONG", field: "DIALOGUE", label: "Dialogues (مکالمے)", value: "LONG:DIALOGUE" },
  { type: "SHORT", field: "PAIR", label: "Words Into Sentences (الفاظ کو جملوں میں استعمال)", value: "SHORT:PAIR" },
  { type: "SHORT", field: "IDIOM", label: "Idioms", value: "SHORT:IDIOM" },
  { type: "LONG", field: "ESSAYS", label: "Essays (مضامین)", value: "LONG:ESSAYS" },
  { type: "LONG", field: "TRANSLATE_UR", label: "Translate Into Urdu Paragraphs", value: "LONG:TRANSLATE_UR" },
  { type: "LONG", field: "PASSAGE", label: "Comprehension Paragraphs (تفہیم عبارات)", value: "LONG:PASSAGE" },
  { type: "LONG", field: "POEM_STANZA", label: "Poems Stanzas", value: "LONG:POEM_STANZA" },
  { type: "LONG", field: "PUNCTUATION", label: "Punctuate the paragraph", value: "LONG:PUNCTUATION" },
  { type: "LONG", field: "TRANSLATE_EN", label: "Translate Into English Paragraphs", value: "LONG:TRANSLATE_EN" },
];

/** Class 9+ Urdu — PTS Generate Paper order (all-topics paper). */
export const URDU_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "QA", label: "Question Answers (سوالات جوابات)", value: "SHORT:QA" },
  { type: "LONG", field: "LETTER", label: "Letters (خطوط)", value: "LONG:LETTER" },
  { type: "LONG", field: "APPLICATION", label: "Applications (درخواستیں)", value: "LONG:APPLICATION" },
  { type: "LONG", field: "POEM", label: "اشعار کی تشریح", value: "LONG:POEM" },
  { type: "SHORT", field: "CORRECT", label: "جملوں کی درستگی", value: "SHORT:CORRECT" },
  { type: "LONG", field: "STORY", label: "Stories (کہانیاں)", value: "LONG:STORY" },
  { type: "LONG", field: "SUMMARY", label: "Summary (خلاصہ) Matric", value: "LONG:SUMMARY" },
  { type: "LONG", field: "CENTRAL", label: "Theme (مرکزی خیال)", value: "LONG:CENTRAL" },
  { type: "LONG", field: "DIALOGUE", label: "Dialogues (مکالمے)", value: "LONG:DIALOGUE" },
  { type: "LONG", field: "PASSAGE", label: "پیراگراف کی تشریح Matric", value: "LONG:PASSAGE" },
  // Class 9 Generate-Paper: no جملوں کی تکمیل / Pointing (kept in bank, hidden from picker)
  { type: "LONG", field: "ESSAYS", label: "Essays (مضامین)", value: "LONG:ESSAYS" },
  { type: "LONG", field: "TAFHEEM", label: "Comprehension Paragraphs (تفہیم عبارات)", value: "LONG:TAFHEEM" },
];

export const ISLAMIYAT_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "QA", label: "Short Questions (مختصر سوالات)", value: "SHORT:QA" },
  { type: "LONG", field: "LONG", label: "Long Questions (تفصیلاً سوالات)", value: "LONG:LONG" },
  { type: "LONG", field: "HADITH", label: "Hadith (احادیث)", value: "LONG:HADITH" },
  { type: "LONG", field: "PERSONALITY", label: "Personalities", value: "LONG:PERSONALITY" },
];

export const TARJUMA_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "QA", label: "Short Questions (مختصر سوالات)", value: "SHORT:QA" },
  { type: "LONG", field: "LONG", label: "Long Questions (تفصیلاً سوالات)", value: "LONG:LONG" },
  { type: "LONG", field: "AYAT", label: "Verses (آیات)", value: "LONG:AYAT" },
  { type: "SHORT", field: "PAIR", label: "Word Meaning (الفاظ معنی)", value: "SHORT:PAIR" },
];

export const ISLAMIYAT_ELECTIVE_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "QA", label: "Short Questions (مختصر سوالات)", value: "SHORT:QA" },
  { type: "LONG", field: "LONG", label: "Long Questions (تفصیلاً سوالات)", value: "LONG:LONG" },
  { type: "LONG", field: "AYAT", label: "Verses (آیات)", value: "LONG:AYAT" },
  { type: "LONG", field: "HADITH", label: "Hadith (احادیث)", value: "LONG:HADITH" },
];

/** Punjabi — PTS-style labels for Class 9 multi-type bank */
export const PUNJABI_QUESTION_TYPE_OPTIONS = [
  { type: "MCQ", field: "MCQ", label: "Multiple Options (چارممکنہ جوابات)", value: "MCQ:MCQ" },
  { type: "SHORT", field: "QA", label: "Question Answers (سوالات جوابات)", value: "SHORT:QA" },
  { type: "SHORT", field: "MEANING", label: "الفاظ معنی", value: "SHORT:MEANING" },
  { type: "SHORT", field: "WORD", label: "Word Meaning (الفاظ معنی)", value: "SHORT:WORD" },
  { type: "SHORT", field: "IDIOM", label: "Idioms / محاورات", value: "SHORT:IDIOM" },
  { type: "LONG", field: "POEM", label: "اشعار کی تشریح", value: "LONG:POEM" },
  { type: "LONG", field: "SUMMARY", label: "Summary (خلاصہ)", value: "LONG:SUMMARY" },
  { type: "LONG", field: "PASSAGE", label: "پیراگراف کی تشریح", value: "LONG:PASSAGE" },
];

/** Exact PTS Generate-Paper style labels (codes → display names). */
const FALLBACK_LABELS = {
  MCQ: "Multiple Options (چارممکنہ جوابات)",
  COMPREHENSION: "Multiple Options (چارممکنہ جوابات)",
  QA: "Short Questions (مختصر سوالات)",
  SHORT: "Short Questions (مختصر سوالات)",
  LONG: "Long Questions (تفصیلاً سوالات)",
  FILL: "Fill in the blanks",
  TRUE_FALSE: "True / False",
  MATCH: "Matching",
  SEQUENCE: "Sequence / Order",
  ARRANGE: "Arrange the letters / words",
  TRACE: "Trace the given line",
  USE_SENTENCE: "Use in your own sentences",
  VOCAB: "Vocabulary / Name the following",
  GENDER: "Gender",
  MISSING_LETTERS: "Fill in the missing letters",
  RHYME: "Rhyming words",
  ESSAY: "Essays (مضامین)",
  SPELLING: "Tick Correct Spelling",
  MEANING: "Correct Meaning Of Underlined Word",
  VERB: "Tick Correct Form Of Verb",
  GRAMMAR: "Tick Correct According To Grammar",
  IDIOM: "Idioms",
  WORD: "Word Meaning (الفاظ معنی)",
  PAIR: "Words Into Sentences (الفاظ کو جملوں میں استعمال)",
  VOICE: "Active & Passive Voice",
  TRANSLATE_EN: "Translate Into English Sentences",
  TRANSLATE_UR: "Translate Into Urdu Paragraphs",
  SUMMARY: "Summary (خلاصہ) Matric",
  PASSAGE: "پیراگراف کی تشریح Matric",
  POEM: "اشعار کی تشریح",
  POEM_STANZA: "Poems Stanzas",
  CORRECT: "جملوں کی درستگی",
  APPLICATION: "Applications (درخواستیں)",
  CENTRAL: "Theme (مرکزی خیال)",
  HADITH: "Hadith (احادیث)",
  PERSONALITY: "Personalities",
  AYAT: "Verses (آیات)",
  LETTER: "Letters (خطوط)",
  STORY: "Stories (کہانیاں)",
  DIALOGUE: "Dialogues (مکالمے)",
  ESSAYS: "Essays (مضامین)",
  TAFHEEM: "Comprehension Paragraphs (تفہیم عبارات)",
};

export function subtypeLabel(subType) {
  const key = String(subType || "").toUpperCase();
  return FALLBACK_LABELS[key] || key || "Questions";
}

export function isEnglishSubjectName(name) {
  return /english/i.test(String(name || "").trim());
}

export function isUrduSubjectName(name) {
  const n = String(name || "").trim().toLowerCase();
  const raw = String(name || "");
  return /urdu|اردو|اُردو/.test(n) || /ردو/.test(raw);
}

export function isIslamiyatSubjectName(name) {
  return /islamiyat|islamic|اسلامیات/i.test(String(name || "").trim());
}

export function isIslamiyatElectiveSubjectName(name) {
  const raw = String(name || "");
  return (
    isIslamiyatSubjectName(raw) &&
    /elective|اختیاری/i.test(raw)
  );
}

export function isTarjumaSubjectName(name) {
  const n = String(name || "").trim().toLowerCase();
  const raw = String(name || "");
  return (
    /tarjuma|tarjama/.test(n) ||
    /ترجمہ|ترجمۃ|ترجمه/.test(raw) ||
    (/quran|قرآن|قرآن/.test(raw) && /ترجم|tarj/i.test(raw + n))
  );
}

export function isPunjabiSubjectName(name) {
  return /punjabi|پنجابی/i.test(String(name || "").trim());
}

export function isClass9ClassName(className) {
  const n = String(className || "").trim();
  return /\b9TH\b/i.test(n) || /\bclass\s*9\b/i.test(n) || /^9$/.test(n);
}

export function isClass10ClassName(className) {
  const n = String(className || "").trim();
  return /\b10TH\b/i.test(n) || /\bclass\s*10\b/i.test(n) || /^10$/.test(n);
}

export function isIntermediateClassName(className) {
  const n = String(className || "").trim();
  return (
    /\bINTER/i.test(n) ||
    /\bclass\s*1[12]\b/i.test(n) ||
    /\b1[12]TH\b/i.test(n) ||
    /^1[12]$/.test(n)
  );
}

export function isSecondaryClassName(className) {
  const n = String(className || "").trim();
  return (
    isIntermediateClassName(n) ||
    isClass10ClassName(n)
  );
}

/** English PTS catalog for the selected class (primary ≠ 9th ≠ 10 ≠ Inter). */
export function englishCatalogForClass(className) {
  if (isClass9ClassName(className)) return CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS;
  if (isClass10ClassName(className)) return CLASS10_ENGLISH_QUESTION_TYPE_OPTIONS;
  if (isSecondaryClassName(className)) return SECONDARY_ENGLISH_QUESTION_TYPE_OPTIONS;
  return PRIMARY_ENGLISH_QUESTION_TYPE_OPTIONS;
}

/** Subjects where chapters can expose different subtypes (not only MCQ/Short/Long). */
function usesPtsTypeFields(subjectName) {
  return (
    isEnglishSubjectName(subjectName) ||
    isUrduSubjectName(subjectName) ||
    isIslamiyatSubjectName(subjectName) ||
    isTarjumaSubjectName(subjectName) ||
    isPunjabiSubjectName(subjectName)
  );
}

/**
 * Science-style subjects: only MCQ + SHORT + LONG (no English/Urdu multi-fields).
 * Used to gate the multi-chapter quota planner popup.
 */
export function isClassicThreeTypeSubject(subjectName, questionTypes = []) {
  if (usesPtsTypeFields(subjectName)) return false;
  const types = new Set();
  for (const row of questionTypes || []) {
    const t = row?.type;
    if (!t) continue;
    if (t !== "MCQ" && t !== "SHORT" && t !== "LONG") return false;
    if ((row.count || 0) > 0 || row.count == null) types.add(t);
  }
  if (!types.size) {
    /* Empty bank / no counts yet — still treat non-PTS as classic. */
    return true;
  }
  return types.has("MCQ") && types.has("SHORT") && types.has("LONG");
}

/** subType values to send to the API for a catalog field */
export function dbSubTypesForField(field) {
  const key = String(field || "").toUpperCase();
  if (!key) return [];
  return FIELD_ALIASES[key] || [key];
}

function countForField(fieldCounts, field) {
  const key = String(field || "").toUpperCase();
  let n = 0;
  for (const alias of dbSubTypesForField(key)) {
    n += Number(fieldCounts[alias] || 0);
  }
  return n;
}

/** Build { FIELD: count } from syllabus questionTypes rows */
export function fieldCountsFromQuestionTypes(questionTypes) {
  const out = {};
  for (const row of questionTypes || []) {
    const st = String(row.subType || row.type || "").toUpperCase();
    if (!st) continue;
    out[st] = (out[st] || 0) + (row.count || 0);
  }
  return out;
}

/**
 * PTS-named type menu from a fixed catalog.
 * Pass chapter/topic-scoped `questionTypes` (via sumQuestionTypesForTopics) so
 * types with 0 questions in the current selection are hidden — matches PTS.
 * English catalog depends on class (primary ≠ 9th ≠ 10/Inter).
 */
export function buildPtsPickerOptions({
  subjectName,
  className,
  questionTypes,
  includeEmpty = false,
} = {}) {
  const counts = fieldCountsFromQuestionTypes(questionTypes);

  /** @type {PtsTypeOption[] | null} */
  let catalog = null;

  if (isEnglishSubjectName(subjectName)) {
    catalog = englishCatalogForClass(className);
  } else if (isUrduSubjectName(subjectName)) {
    catalog =
      isClass9ClassName(className) || isSecondaryClassName(className)
        ? URDU_QUESTION_TYPE_OPTIONS
        : PRIMARY_URDU_QUESTION_TYPE_OPTIONS;
  } else if (isIslamiyatElectiveSubjectName(subjectName)) {
    catalog = ISLAMIYAT_ELECTIVE_QUESTION_TYPE_OPTIONS;
  } else if (isIslamiyatSubjectName(subjectName)) {
    catalog = ISLAMIYAT_QUESTION_TYPE_OPTIONS;
  } else if (isTarjumaSubjectName(subjectName)) {
    catalog = TARJUMA_QUESTION_TYPE_OPTIONS;
  } else if (isPunjabiSubjectName(subjectName)) {
    catalog = PUNJABI_QUESTION_TYPE_OPTIONS;
  }

  if (!catalog) {
    return buildPickerOptions(questionTypes);
  }

  /** Fixed PTS catalog only — do not append extra discovered/custom subtypes. */
  const mapped = [];
  for (const opt of catalog) {
    const count = countForField(counts, opt.field);
    if (!includeEmpty && !(count > 0)) continue;
    mapped.push({
      value: opt.value,
      type: opt.type,
      subType: opt.field,
      label: opt.label,
      count,
    });
  }

  return mapped;
}

/**
 * Sum type+subType counts for selected topics (for syllabus chips / availability).
 */
export function sumQuestionTypesForTopics(
  chapters,
  selectedTopicIds,
  subjectQuestionTypes
) {
  const selected = new Set(selectedTopicIds || []);
  if (!selected.size) {
    return Array.isArray(subjectQuestionTypes) ? subjectQuestionTypes : [];
  }

  const map = new Map();
  for (const ch of chapters || []) {
    for (const topic of ch.topics || []) {
      if (!selected.has(topic.id)) continue;
      const rows =
        Array.isArray(topic.questionTypes) && topic.questionTypes.length
          ? topic.questionTypes
          : Object.entries(topic.countsBySubType || {}).map(
              ([subType, count]) => ({
                type: inferTypeFromSubType(subType, topic.countsByType),
                subType,
                count,
              })
            );
      for (const row of rows) {
        if (!row?.type || !(row.count > 0)) continue;
        const st = String(row.subType || row.type || "").toUpperCase();
        const key = `${row.type}::${st}`;
        const prev = map.get(key) || { type: row.type, subType: st, count: 0 };
        prev.count += row.count;
        map.set(key, prev);
      }
    }
  }
  return [...map.values()];
}

function inferTypeFromSubType(subType, countsByType = {}) {
  const st = String(subType || "").toUpperCase();
  if (
    st === "MCQ" ||
    st === "COMPREHENSION" ||
    st === "SPELLING" ||
    st === "SYNONYM" ||
    st === "VERB" ||
    st === "GRAMMAR"
  ) {
    return "MCQ";
  }
  if (st === "MEANING") {
    return (countsByType.SHORT || 0) > (countsByType.MCQ || 0) ? "SHORT" : "MCQ";
  }
  if (
    st === "QA" ||
    st === "CORRECT" ||
    st === "IDIOM" ||
    st === "WORD" ||
    st === "PAIR" ||
    st === "VOICE" ||
    st === "DI" ||
    st === "TRANSLATE_EN" ||
    st === "FILL" ||
    st === "TRUE_FALSE" ||
    st === "MATCH" ||
    st === "SEQUENCE" ||
    st === "ARRANGE" ||
    st === "TRACE" ||
    st === "USE_SENTENCE" ||
    st === "VOCAB" ||
    st === "GENDER" ||
    st === "MISSING_LETTERS" ||
    st === "RHYME"
  ) {
    return "SHORT";
  }
  return "LONG";
}

/** Generic fallback when subject has no PTS catalog — flat PTS labels. */
function buildPickerOptions(questionTypes) {
  const rows = Array.isArray(questionTypes) ? questionTypes : [];
  if (!rows.length) {
    return [
      {
        value: "MCQ:",
        type: "MCQ",
        subType: null,
        label: "Multiple Options (چارممکنہ جوابات)",
        count: 0,
      },
      {
        value: "SHORT:",
        type: "SHORT",
        subType: null,
        label: "Short Questions (مختصر سوالات)",
        count: 0,
      },
      {
        value: "LONG:",
        type: "LONG",
        subType: null,
        label: "Long Questions (تفصیلاً سوالات)",
        count: 0,
      },
    ];
  }

  const order = { MCQ: 0, SHORT: 1, LONG: 2 };
  return rows
    .filter((r) => (r.count || 0) > 0)
    .sort((a, b) => {
      const od = (order[a.type] ?? 9) - (order[b.type] ?? 9);
      if (od !== 0) return od;
      return String(a.subType || "").localeCompare(String(b.subType || ""));
    })
    .map((r) => {
      const type = r.type;
      const subType = r.subType ? String(r.subType).toUpperCase() : null;
      const label =
        r.label ||
        (subType ? subtypeLabel(subType) : TYPE_GROUP_LABELS[type] || type);
      return {
        value: `${type}:${subType || ""}`,
        type,
        subType,
        label,
        count: r.count || 0,
      };
    });
}

export function parsePickerValue(value) {
  const [type, subType = ""] = String(value || "").split(":");
  if (type !== "MCQ" && type !== "SHORT" && type !== "LONG") return null;
  return {
    type,
    subType: subType ? subType.toUpperCase() : null,
  };
}
