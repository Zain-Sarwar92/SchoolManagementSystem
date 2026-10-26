/**
 * PaperBlueprint — single contract for create / save / load / print.
 * Keep fields stable so every surface normalizes the same way.
 */

export const TYPE_META = {
  MCQ: {
    label: "MCQs",
    short: "MCQs",
    urdu: "کثیر الانتخابی سوالات",
    part: "objective",
    instructionEn: "Choose the correct answer.",
    instructionUr: "درج ذیل سوالات کے صحیح جوابات کا انتخاب کیجیے۔",
  },
  SHORT: {
    label: "Short Questions",
    short: "Short Questions",
    urdu: "مختصر سوالات",
    part: "subjective",
    instructionEn: "Write short answers of the following questions.",
    instructionUr: "مندرجہ ذیل سوالات کے مختصر جوابات تحریر کریں۔",
  },
  LONG: {
    label: "Long Questions",
    short: "Long Questions",
    urdu: "تفصیلی سوالات",
    part: "subjective",
    instructionEn: "Write detailed answers of the following questions.",
    instructionUr: "مندرجہ ذیل سوالات کے تفصیلی جوابات تحریر کریں۔",
  },
};

/**
 * Board / board-style question headings by catalog field (subType).
 * Falls back to TYPE_META when a field has no dedicated heading.
 */
export const FIELD_HEADINGS = {
  /* ── MCQ ── */
  COMPREHENSION: {
    en: "Choose the correct answer.",
    ur: "درج ذیل سوالات کے صحیح جوابات کا انتخاب کیجیے۔",
  },
  MCQ: {
    en: "Choose the correct answer.",
    ur: "درج ذیل سوالات کے صحیح جوابات کا انتخاب کیجیے۔",
  },
  /* English Matric — EmHeading/UmHeading from live Generate Paper QuestionSubType */
  SPELLING: {
    en: "Choose the word with correct spelling.",
    ur: "درست ہجے والا لفظ منتخب کیجیے۔",
  },
  MEANING: {
    en: "Choose the correct meaning of underlined word.",
    ur: "خط کشیدہ لفظ کا درست مطلب منتخب کیجیے۔",
  },
  VERB: {
    en: "Choose the correct form of verb.",
    ur: "فعل کی درست شکل کا انتخاب کیجیے۔",
  },
  GRAMMAR: {
    en: "Choose the correct option according to grammar.",
    ur: "قواعد کے مطابق درست اختیار کا انتخاب کیجیے۔",
  },
  SYNONYM: {
    en: "Tick the correct synonym / antonym.",
    ur: "درست مترادف / متضاد کا انتخاب کیجیے۔",
  },

  /* ── SHORT ── */
  QA: {
    en: "Write answers on the following questions.",
    ur: "مندرجہ ذیل سوالات کے جوابات تحریر کریں۔",
  },
  SHORT: {
    en: "Write short answers of the following questions.",
    ur: "مندرجہ ذیل سوالات کے مختصر جوابات تحریر کریں۔",
  },
  FILL: {
    en: "Fill in the blanks.",
    ur: "خالی جگہ پُر کیجیے۔",
  },
  TRUE_FALSE: {
    en: "Write True or False.",
    ur: "درست یا غلط تحریر کیجیے۔",
  },
  ARRANGE: {
    en: "Arrange the following letters / words.",
    ur: "درج ذیل الفاظ کو ترتیب دیجیے۔",
  },
  TRACE: {
    en: "Trace the given line.",
    ur: "دی گئی لکیر کو ٹریس کیجیے۔",
  },
  WORD: {
    en: "Use the following words in your own sentences.",
    ur: "درج ذیل الفاظ کو اپنے جملوں میں استعمال کیجیے۔",
  },
  USE_SENTENCE: {
    en: "Use the following in your own sentences.",
    ur: "درج ذیل کو اپنے جملوں میں استعمال کیجیے۔",
  },
  VOCAB: {
    en: "Name / write the following.",
    ur: "درج ذیل کے نام تحریر کیجیے۔",
  },
  GENDER: {
    en: "Write the gender of the following.",
    ur: "درج ذیل کا جنس تحریر کیجیے۔",
  },
  MISSING_LETTERS: {
    en: "Fill in the missing letters.",
    ur: "غائب حروف پُر کیجیے۔",
  },
  RHYME: {
    en: "Write rhyming words.",
    ur: "ہم آواز الفاظ تحریر کیجیے۔",
  },
  PAIR: {
    en: "Use the following pair of words in your own sentences.",
    ur: "درج ذیل جوڑے دار الفاظ کو اپنے جملوں میں استعمال کیجیے۔",
  },
  IDIOM: {
    en: "Use the following idioms in your sentences.",
    ur: "درج ذیل محاورات کو اپنے جملوں میں استعمال کیجیے۔",
  },
  VOICE: {
    en: "Change the voice of the following.",
    ur: "درج ذیل کی حالتِ فعل تبدیل کیجیے۔",
  },
  DI: {
    en: "Change the following sentences into indirect form.",
    ur: "درج ذیل جملوں کو بالواسطہ کلام میں تبدیل کیجیے۔",
  },
  /* Class 9 English sentences (subtype 21). Class 10 paragraphs override below. */
  TRANSLATE_EN: {
    en: "Translate the following sentences into English.",
    ur: "مندرجہ ذیل جملوں کا انگلش میں ترجمہ تحریر کریں۔",
  },
  CORRECT: {
    en: "Correct the following sentences.",
    ur: "درج ذیل جملوں کی درستگی کیجیے۔",
  },
  MATCH: {
    en: "Match the following.",
    ur: "درج ذیل کا ملاپ کیجیے۔",
  },
  SEQUENCE: {
    en: "Arrange in the correct order.",
    ur: "درست ترتیب میں لگائیے۔",
  },

  /* ── LONG ── */
  LONG: {
    en: "Write detailed answers of the following questions.",
    ur: "مندرجہ ذیل سوالات کے تفصیلی جوابات تحریر کریں۔",
  },
  SUMMARY: {
    en: "Write down the summary of the poem.",
    ur: "مندرجہ ذیل نثر کا خلاصہ تحریر کریں۔",
  },
  POEM_STANZA: {
    en: "Explain the following lines with reference to the context.",
    ur: "درج ذیل سطور کی سیاق و سباق کے حوالے سے تشریح کیجیے۔",
  },
  POEM: {
    en: "Explain the following verses.",
    ur: "درج ذیل اشعار کی تشریح کیجیے۔",
  },
  LETTER: {
    en: "Write a letter on any one of the following topics.",
    ur: "درج ذیل میں سے کسی ایک موضوع پر خط تحریر کیجیے۔",
  },
  APPLICATION: {
    en: "Write an application on any one of the following topics.",
    ur: "درج ذیل میں سے کسی ایک موضوع پر درخواست تحریر کیجیے۔",
  },
  STORY: {
    en: "Write a story on any one of the following topics.",
    ur: "درج ذیل میں سے کسی ایک موضوع پر کہانی تحریر کیجیے۔",
  },
  DIALOGUE: {
    en: "Write a dialogue on any one of the following topics.",
    ur: "درج ذیل میں سے کسی ایک موضوع پر مکالمہ تحریر کیجیے۔",
  },
  ESSAY: {
    en: "Write an essay on the following topic.",
    ur: "مندرجہ ذیل عنوان پر مضمون تحریر کریں۔",
  },
  ESSAYS: {
    en: "Write an essay on the following topic.",
    ur: "مندرجہ ذیل عنوان پر مضمون تحریر کریں۔",
  },
  TRANSLATE_UR: {
    en: "Translate the following paragraph into Urdu.",
    ur: "درج ذیل پیراگراف کا اردو میں ترجمہ کیجیے۔",
  },
  PASSAGE: {
    en: "Read the following passage carefully and answer the questions given at the end.",
    ur: "درج ذیل پیراگراف غور سے پڑھیے اور آخر میں دیے گئے سوالات کے جوابات دیجیے۔",
  },
  TAFHEEM: {
    en: "Read the following passage carefully and answer the questions given at the end.",
    ur: "درج ذیل عبارت کی تفہیم کیجیے اور سوالات کے جوابات دیجیے۔",
  },
  PUNCTUATION: {
    en: "Punctuate the following paragraph.",
    ur: "درج ذیل پیراگراف میں رموزِ اوقاف لگائیے۔",
  },
  CENTRAL: {
    en: "Write the central idea / theme of the following.",
    ur: "درج ذیل کا مرکزی خیال تحریر کیجیے۔",
  },
  HADITH: {
    en: "Explain the following Hadith.",
    ur: "درج ذیل حدیث کی تشریح کیجیے۔",
  },
  PERSONALITY: {
    en: "Write about the following personality.",
    ur: "درج ذیل شخصیت کے بارے میں تحریر کیجیے۔",
  },
  AYAT: {
    en: "Explain the following verses.",
    ur: "درج ذیل آیات کی تشریح کیجیے۔",
  },
};

/**
 * Urdu / Punjabi Matric — board-style headings (field codes overlap English
 * e.g. PASSAGE = تشریح vs English comprehension).
 */
/** Exact board Generate-Paper Urdu Matric headings (from live Generate Paper print). */
const URDU_MATRIC_FIELD_HEADINGS = {
  MCQ: {
    en: "Circle the correct option from the four possible answers.",
    ur: "چار ممکنہ جوابات میں سے درست پر دائرہ لگائیں۔",
  },
  QA: {
    en: "Write answers to the following questions.",
    ur: "مندرجہ ذیل سوالات کے جوابات تحریر کریں۔",
  },
  CORRECT: {
    en: "Correct the following sentences.",
    ur: "مندرجہ ذیل جملوں کی درستگی کریں۔",
  },
  IDIOM: {
    en: "Complete the following sentences / idioms.",
    ur: "مندرجہ ذیل جملوں کی تکمیل کریں۔",
  },
  MEANING: {
    en: "Apply the correct diacritics (اعراب).",
    ur: "مندرجہ ذیل الفاظ پر اعراب لگائیں۔",
  },
  LETTER: {
    en: "Write a letter on the following topic.",
    ur: "مندرجہ ذیل عنوان پر خط لکھیں۔",
  },
  APPLICATION: {
    en: "Write an application on the following topic.",
    ur: "مندرجہ ذیل عنوان پر درخواست لکھیں۔",
  },
  POEM: {
    en: "Explain the following poem / ghazal verses.",
    ur: "مندرجہ ذیل نظم و غزل کے اشعار کی تشریح کریں۔",
  },
  STORY: {
    en: "Write a story on the following topic.",
    ur: "مندرجہ ذیل عنوان پر کہانی تحریر کریں۔",
  },
  SUMMARY: {
    en: "Write the summary of the following prose.",
    ur: "مندرجہ ذیل نثر کا خلاصہ تحریر کریں۔",
  },
  CENTRAL: {
    en: "Write the central idea / summary of the following poem (also write the poet's name).",
    ur: "مندرجہ ذیل نظم کا مرکزی خیال / خلاصہ تحریر کریں۔ (شاعر کا نام بھی تحریر کریں)",
  },
  DIALOGUE: {
    en: "Write a dialogue on the following topic.",
    ur: "مندرجہ ذیل موضوع پر مکالمہ تحریر کریں۔",
  },
  PASSAGE: {
    en: "Explain the following paragraph; also write meanings of underlined words, lesson name and author's name.",
    ur: "مندرجہ ذیل پیرا گراف کی تشریح کریں نیز خط کشیدہ الفاظ کے معنی، سبق کا نام اور مصنف کا نام بھی تحریر کریں۔",
  },
  ESSAYS: {
    en: "Write an essay on the following topic.",
    ur: "مندرجہ ذیل عنوان پر مضمون تحریر کریں۔",
  },
  TAFHEEM: {
    en: "Read the following passage and answer the questions.",
    ur: "مندرجہ ذیل عبارت کی تفہیم کریں اور سوالات کے جوابات تحریر کریں۔",
  },
};

/** Urdu / Punjabi — papers use Urdu-only section headings (no English line). */
export function isUrduLikeSubject(name) {
  const raw = String(name || "");
  const n = raw.trim().toLowerCase();
  return (
    /urdu|اردو|اُردو|punjabi|پنجابی/.test(n) ||
    /ردو/.test(raw) ||
    /پنجابی/.test(raw)
  );
}

/** Live Generate Paper Class 10 English EmHeading for Translate Into English Paragraphs (44). */
const CLASS10_TRANSLATE_EN_HEADING = {
  en: "Translate the following paragraph into English.",
  ur: "مندرجہ ذیل پیراگراف کا انگلش میں ترجمہ تحریر کریں۔",
};

function isClass10ClassName(className) {
  const n = String(className || "").trim();
  return /\b10TH\b/i.test(n) || /\bclass\s*10\b/i.test(n) || /^10$/.test(n);
}

/**
 * Section question heading from type + field (subType).
 * Pass `subjectName` so Urdu Matric PASSAGE/POEM use تشریح wording
 * (not English comprehension prompts).
 * Pass `className` for Class 10 English paragraph-translate heading.
 */
export function sectionInstruction(type, subType, opts = {}) {
  const field = String(subType || "").toUpperCase();
  const subjectName = opts.subjectName || opts.subjectLabel || "";
  const className = opts.className || opts.classLabel || "";
  if (field && isUrduLikeSubject(subjectName) && URDU_MATRIC_FIELD_HEADINGS[field]) {
    return URDU_MATRIC_FIELD_HEADINGS[field];
  }
  if (
    field === "TRANSLATE_EN" &&
    isClass10ClassName(className) &&
    /english/i.test(String(subjectName || ""))
  ) {
    return CLASS10_TRANSLATE_EN_HEADING;
  }
  if (field && FIELD_HEADINGS[field]) return FIELD_HEADINGS[field];
  const meta = TYPE_META[type] || TYPE_META.SHORT;
  return {
    en: meta.instructionEn,
    ur: meta.instructionUr,
  };
}

/** Stem that only repeats the section heading (e.g. SPELLING bank text). */
export function isRedundantInstructionStem(text, type, subType) {
  const norm = (s) =>
    String(s || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[.:!?]+$/g, "");
  const stem = norm(text);
  if (stem.length < 8) return false;
  const heading = sectionInstruction(type, subType);
  return stem === norm(heading.en) || stem === norm(heading.ur);
}

export const TYPE_GROUP_LABELS = {
  MCQ: "MCQs",
  SHORT: "Short Questions",
  LONG: "Long Questions",
};

const TYPE_ORDER = { MCQ: 0, SHORT: 1, LONG: 2 };

export function sortPaperSections(list = []) {
  return [...list].sort((a, b) => {
    const td = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
    if (td !== 0) return td;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

export function sectionScoredCount(section) {
  const total = section?.questions?.length || 0;
  const attempt = Number(section?.attemptCount);
  if (!Number.isFinite(attempt) || attempt <= 0) return total;
  return Math.min(total, attempt);
}

/** Per scored question marks (falls back to section marksEach). */
export function sectionQuestionMarks(section) {
  const each = Number(section?.marksEach) || 0;
  const n = sectionScoredCount(section);
  return (section?.questions || []).slice(0, n).map((q) => {
    const m = Number(q?.marks);
    return Number.isFinite(m) && m > 0 ? m : each;
  });
}

export function sectionTotalMarks(section) {
  const marks = sectionQuestionMarks(section);
  if (marks.length) return marks.reduce((sum, m) => sum + m, 0);
  const each = Number(section?.marksEach);
  return Number.isFinite(each) && each > 0 ? 0 : 0;
}

export function paperTotalMarks(sections = []) {
  return sections.reduce((sum, s) => sum + sectionTotalMarks(s), 0);
}

/** Equal → `5 x 2 = 10`; mixed → `4 + 5 = 9` (board-style). */
export function marksLine(section) {
  const marks = sectionQuestionMarks(section);
  if (!marks.length) {
    const each = Number(section?.marksEach) || 0;
    return `${each} x 0 = 0`;
  }
  const total = marks.reduce((sum, m) => sum + m, 0);
  if (marks.every((m) => m === marks[0])) {
    return `${marks[0]} x ${marks.length} = ${total}`;
  }
  return `${marks.join(" + ")} = ${total}`;
}

/** UI medium (ENGLISH|URDU|BOTH) ↔ API (english|urdu|dual) */
export function mediumToApi(medium) {
  if (medium === "URDU" || medium === "urdu") return "urdu";
  if (medium === "BOTH" || medium === "dual") return "dual";
  return "english";
}

export function mediumFromApi(medium) {
  if (medium === "urdu") return "URDU";
  if (medium === "dual") return "BOTH";
  return "ENGLISH";
}

function questionId(q, type, index) {
  return String(q?.question || q?.id || `${type || "Q"}-${index}`);
}

export function normalizeQuestion(q, sectionType, index = 0) {
  const marksRaw = Number(q?.marks);
  const marks = Number.isFinite(marksRaw) && marksRaw > 0 ? marksRaw : 0;
  return {
    ...q,
    id: questionId(q, sectionType, index),
    question: q?.question || q?.id || null,
    type: q?.type || sectionType,
    text: q?.text ?? "",
    textUrdu: q?.textUrdu ?? null,
    optionA: q?.optionA ?? null,
    optionB: q?.optionB ?? null,
    optionC: q?.optionC ?? null,
    optionD: q?.optionD ?? null,
    correctAnswer: q?.correctAnswer ?? null,
    marks,
    order: Number.isFinite(Number(q?.order)) ? Number(q.order) : index,
  };
}

export function normalizeSection(section, index = 0) {
  const type = section?.type || "MCQ";
  const marksRaw = Number(section?.marksEach);
  const marksEach = Number.isFinite(marksRaw) && marksRaw > 0 ? marksRaw : 0;
  const questions = (section?.questions || []).map((q, i) => {
    const nq = normalizeQuestion(q, type, i);
    /* Inherit section marks when question has none */
    if (!(nq.marks > 0) && marksEach > 0) nq.marks = marksEach;
    return nq;
  });

  return {
    key: section?.key || `sec-${index + 1}-${type}`,
    type,
    subType: section?.subType || null,
    order: Number(section?.order) || index + 1,
    attemptCount: Number(section?.attemptCount) || 0,
    marksEach,
    questions,
  };
}

/**
 * Canonical blueprint used by workspace, API save, and print.
 */
export function normalizeBlueprint(input = {}) {
  const sections = sortPaperSections(
    (input.sections || []).map((s, i) => normalizeSection(s, i))
  );
  const meta = {
    title: String(input.title || input.meta?.title || "").trim(),
    boardLabel: String(
      input.boardLabel || input.meta?.boardLabel || "Punjab Textbook"
    ).trim(),
    classLabel: String(
      input.classLabel || input.meta?.classLabel || ""
    ).trim(),
    subjectLabel: String(
      input.subjectLabel || input.meta?.subjectLabel || ""
    ).trim(),
    subjectId: input.subjectId || input.meta?.subjectId || input.subject || null,
    medium: mediumToApi(input.medium || input.meta?.medium || "english"),
    paperCategory: String(
      input.paperCategory || input.meta?.paperCategory || ""
    ).trim(),
    examDate: input.examDate || input.meta?.examDate || null,
    durationMinutes:
      Number(input.durationMinutes || input.meta?.durationMinutes) || 60,
    instructions: String(
      input.instructions || input.meta?.instructions || ""
    ).trim(),
    syllabusNote: String(
      input.syllabusNote || input.meta?.syllabusNote || ""
    ).trim(),
    distributionMode:
      input.distributionMode === "RANDOM" ? "RANDOM" : "BALANCED",
  };

  return {
    meta,
    sections,
    totalMarks: paperTotalMarks(sections),
  };
}

export function blueprintFromApiPaper(paper) {
  if (!paper) return normalizeBlueprint({});
  return normalizeBlueprint({
    title: paper.title,
    boardLabel: paper.boardLabel,
    classLabel: paper.classLabel,
    subjectLabel: paper.subjectLabel,
    subjectId: paper.subject?._id || paper.subject || null,
    medium: paper.medium,
    paperCategory: paper.paperCategory,
    examDate: paper.examDate
      ? String(paper.examDate).slice(0, 10)
      : "",
    durationMinutes: paper.durationMinutes,
    instructions: paper.instructions,
    syllabusNote: paper.syllabusNote,
    distributionMode: paper.distributionMode,
    sections: paper.sections,
  });
}

/** Body for POST/PUT /generator/papers */
export function blueprintToApiBody(blueprint, extras = {}) {
  const b = normalizeBlueprint(blueprint);
  return {
    title: b.meta.title,
    boardLabel: b.meta.boardLabel,
    classLabel: b.meta.classLabel,
    subjectLabel: b.meta.subjectLabel,
    subjectId: b.meta.subjectId,
    medium: b.meta.medium,
    paperCategory: b.meta.paperCategory,
    examDate: b.meta.examDate || null,
    durationMinutes: b.meta.durationMinutes,
    instructions: b.meta.instructions,
    syllabusNote: b.meta.syllabusNote,
    distributionMode: b.meta.distributionMode,
    totalMarks: b.totalMarks,
    sections: b.sections.map((s) => ({
      key: s.key,
      type: s.type,
      subType: s.subType,
      order: s.order,
      attemptCount: s.attemptCount,
      marksEach: s.marksEach,
      questions: s.questions.map((q, i) => ({
        question: q.question || q.id || null,
        type: q.type || s.type,
        text: q.text,
        textUrdu: q.textUrdu,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        marks: q.marks > 0 ? q.marks : s.marksEach,
        order: i,
      })),
    })),
    ...extras,
  };
}

/** Payload for openGeneratorPrintTab / print page */
export function blueprintToPrintPayload(blueprint, extras = {}) {
  const b = normalizeBlueprint(blueprint);
  const { meta: extraMeta, ...rest } = extras || {};
  return {
    meta: {
      title: b.meta.title,
      boardLabel: b.meta.boardLabel,
      classLabel: b.meta.classLabel,
      subjectLabel: b.meta.subjectLabel,
      subjectName: b.meta.subjectLabel,
      paperCategory: b.meta.paperCategory,
      examDate: b.meta.examDate,
      durationMinutes: b.meta.durationMinutes,
      instructions: b.meta.instructions,
      syllabusNote: b.meta.syllabusNote,
      totalMarks: b.totalMarks,
      ...(extraMeta && typeof extraMeta === "object" ? extraMeta : {}),
    },
    medium:
      b.meta.medium === "urdu"
        ? "URDU"
        : b.meta.medium === "dual"
          ? "BOTH"
          : "ENGLISH",
    sections: b.sections,
    totalMarks: b.totalMarks,
    ...rest,
  };
}

/** True when every section has teacher-entered marks (> 0). */
export function blueprintHasMarks(sections = []) {
  if (!sections.length) return false;
  return sections.every((s) => Number(s.marksEach) > 0);
}
