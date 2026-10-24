/**
 * PTS QuestionSubTypeID → bank mapping.
 * Same ID can mean different fields per subject/class (e.g. English 14 = TRACE vs QA).
 */

export const PTS_SUBTYPE_DEFAULT = {
  1: { name: "mcq", bankType: "mcq", field: "MCQ" },
  2: { name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
  3: { name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
  5: { name: "mcq-verb", bankType: "mcq", field: "VERB" },
  6: { name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
  7: { name: "fill", bankType: "short", field: "FILL" },
  8: { name: "matching", bankType: "short", field: "MATCH" },
  9: { name: "sequence", bankType: "short", field: "SEQUENCE" },
  10: { name: "true-false", bankType: "short", field: "TRUE_FALSE" },
  11: { name: "arrange", bankType: "short", field: "ARRANGE" },
  12: { name: "short", bankType: "short", field: "QA" },
  13: { name: "long", bankType: "long", field: "LONG" },
  14: { name: "short-qa", bankType: "short", field: "QA" },
  15: { name: "long-letter", bankType: "long", field: "LETTER" },
  16: { name: "long-application", bankType: "long", field: "APPLICATION" },
  17: { name: "long-ayat", bankType: "long", field: "AYAT" },
  18: { name: "long-hadith", bankType: "long", field: "HADITH" },
  19: { name: "long-poem", bankType: "long", field: "POEM" },
  21: { name: "short-translate-en", bankType: "short", field: "TRANSLATE_EN" },
  22: { name: "short-voice", bankType: "short", field: "VOICE" },
  24: { name: "short-correct", bankType: "short", field: "CORRECT" },
  25: { name: "short-idiom", bankType: "short", field: "IDIOM" },
  26: { name: "long-story", bankType: "long", field: "STORY" },
  28: { name: "long-summary", bankType: "long", field: "SUMMARY" },
  30: { name: "long-central", bankType: "long", field: "CENTRAL" },
  31: { name: "long-dialogue", bankType: "long", field: "DIALOGUE" },
  34: { name: "short-word", bankType: "short", field: "WORD" },
  36: { name: "short-idioms", bankType: "short", field: "IDIOM" },
  37: { name: "use-in-sentences", bankType: "short", field: "USE_SENTENCE" },
  38: { name: "vocabulary", bankType: "short", field: "VOCAB" },
  39: { name: "gender", bankType: "short", field: "GENDER" },
  42: { name: "short-meaning", bankType: "short", field: "MEANING" },
  43: { name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
  45: { name: "long-passage", bankType: "long", field: "PASSAGE" },
  47: { name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
  48: { name: "long-passage", bankType: "long", field: "PASSAGE" },
  56: { name: "missing-letters", bankType: "short", field: "MISSING_LETTERS" },
  57: { name: "long-personality", bankType: "long", field: "PERSONALITY" },
};

/** Class 9+ English (matric / Inter). */
export const ENGLISH_MATRIC_SUBTYPES = {
  1: { name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
  2: { name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
  3: { name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
  5: { name: "mcq-verb", bankType: "mcq", field: "VERB" },
  6: { name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
  14: { name: "short-qa", bankType: "short", field: "QA" },
  15: { name: "long-letters", bankType: "long", field: "LETTER" },
  21: { name: "short-translate-en", bankType: "short", field: "TRANSLATE_EN" },
  22: { name: "short-voice", bankType: "short", field: "VOICE" },
  26: { name: "long-stories", bankType: "long", field: "STORY" },
  28: { name: "long-summary", bankType: "long", field: "SUMMARY" },
  31: { name: "long-dialogues", bankType: "long", field: "DIALOGUE" },
  34: { name: "short-word", bankType: "short", field: "WORD" },
  36: { name: "short-idioms", bankType: "short", field: "IDIOM" },
  43: { name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
  45: { name: "long-comprehension-para", bankType: "long", field: "PASSAGE" },
  47: { name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
};

/** Primary English (ONE–8TH) — every PTS subtype ID stays distinct. */
export const ENGLISH_PRIMARY_SUBTYPES = {
  1: { name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
  2: { name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
  3: { name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
  6: { name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
  7: { name: "fill", bankType: "short", field: "FILL" },
  10: { name: "true-false", bankType: "short", field: "TRUE_FALSE" },
  11: { name: "arrange", bankType: "short", field: "ARRANGE" },
  14: { name: "trace", bankType: "short", field: "TRACE" },
  15: { name: "letter", bankType: "long", field: "LETTER" },
  16: { name: "application", bankType: "long", field: "APPLICATION" },
  26: { name: "story", bankType: "long", field: "STORY" },
  27: { name: "essay", bankType: "long", field: "ESSAY" },
  34: { name: "words-sentences", bankType: "short", field: "WORD" },
  37: { name: "use-in-sentences", bankType: "short", field: "USE_SENTENCE" },
  38: { name: "vocabulary", bankType: "short", field: "VOCAB" },
  39: { name: "gender", bankType: "short", field: "GENDER" },
  43: { name: "translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
  52: { name: "rhyme", bankType: "short", field: "RHYME" },
  56: { name: "missing-letters", bankType: "short", field: "MISSING_LETTERS" },
};

/** Primary Urdu — keep subtype IDs distinct. */
export const URDU_PRIMARY_SUBTYPES = {
  1: { name: "mcq", bankType: "mcq", field: "MCQ" },
  7: { name: "fill", bankType: "short", field: "FILL" },
  10: { name: "true-false", bankType: "short", field: "TRUE_FALSE" },
  11: { name: "arrange", bankType: "short", field: "ARRANGE" },
  14: { name: "short-qa", bankType: "short", field: "QA" },
  34: { name: "words-sentences", bankType: "short", field: "WORD" },
  37: { name: "use-in-sentences", bankType: "short", field: "USE_SENTENCE" },
  38: { name: "vocabulary", bankType: "short", field: "VOCAB" },
  39: { name: "gender", bankType: "short", field: "GENDER" },
  45: { name: "passage", bankType: "long", field: "PASSAGE" },
};

/** Matric Urdu (9TH+). */
export const URDU_MATRIC_SUBTYPES = {
  1: { name: "mcq", bankType: "mcq", field: "MCQ" },
  14: { name: "short-qa", bankType: "short", field: "QA" },
  15: { name: "long-letter", bankType: "long", field: "LETTER" },
  16: { name: "long-application", bankType: "long", field: "APPLICATION" },
  19: { name: "long-poem", bankType: "long", field: "POEM" },
  24: { name: "short-correct", bankType: "short", field: "CORRECT" },
  25: { name: "short-idiom", bankType: "short", field: "IDIOM" },
  26: { name: "long-story", bankType: "long", field: "STORY" },
  28: { name: "long-summary", bankType: "long", field: "SUMMARY" },
  30: { name: "long-central", bankType: "long", field: "CENTRAL" },
  31: { name: "long-dialogue", bankType: "long", field: "DIALOGUE" },
  42: { name: "short-meaning", bankType: "short", field: "MEANING" },
  48: { name: "long-passage", bankType: "long", field: "PASSAGE" },
};

export const PTS_SUBTYPE_BY_SUBJECT = [
  {
    test: /پنجابی|punjabi/i,
    map: {
      1: { name: "mcq", bankType: "mcq", field: "MCQ" },
      14: { name: "short-qa", bankType: "short", field: "QA" },
      19: { name: "long-poem", bankType: "long", field: "POEM" },
      28: { name: "long-summary", bankType: "long", field: "SUMMARY" },
      34: { name: "short-meaning", bankType: "short", field: "MEANING" },
      37: { name: "short-word", bankType: "short", field: "WORD" },
      38: { name: "short-idiom", bankType: "short", field: "IDIOM" },
      48: { name: "long-passage", bankType: "long", field: "PASSAGE" },
    },
  },
  {
    test: /اسلامیات\s*اختیاری|islamiyat\s*elective/i,
    map: {
      1: { name: "mcq", bankType: "mcq", field: "MCQ" },
      12: { name: "short", bankType: "short", field: "QA" },
      17: { name: "long-ayat", bankType: "long", field: "AYAT" },
    },
  },
  {
    test: /اسلامیات|islamiyat|islamic/i,
    map: {
      1: { name: "mcq", bankType: "mcq", field: "MCQ" },
      12: { name: "short", bankType: "short", field: "QA" },
      13: { name: "long", bankType: "long", field: "LONG" },
      18: { name: "long-hadith", bankType: "long", field: "HADITH" },
      57: { name: "long-personality", bankType: "long", field: "PERSONALITY" },
    },
  },
  {
    test: /ترجم|tarjuma|quran/i,
    map: {
      1: { name: "mcq", bankType: "mcq", field: "MCQ" },
      12: { name: "short", bankType: "short", field: "QA" },
      13: { name: "long", bankType: "long", field: "LONG" },
      17: { name: "long-ayat", bankType: "long", field: "AYAT" },
      37: { name: "short-meaning", bankType: "short", field: "WORD" },
    },
  },
];

export const PTS_SUBTYPE_PROBE_IDS = [
  ...new Set([
    ...Object.keys(PTS_SUBTYPE_DEFAULT).map(Number),
    ...Array.from({ length: 80 }, (_, i) => i + 1),
  ]),
].sort((a, b) => a - b);

function isPrimaryClassName(className) {
  const n = String(className || "").trim().toUpperCase();
  if (!n) return true;
  if (/\b(9TH|10TH|INTER|CLASS\s*9|CLASS\s*1[012])\b/.test(n)) return false;
  if (/^(9|10|11|12)$/.test(n)) return false;
  return true;
}

export function resolvePtsSubType(subjectName, subTypeId, className) {
  const id = Number(subTypeId);
  const name = String(subjectName || "");

  if (/english/i.test(name)) {
    const map = isPrimaryClassName(className)
      ? ENGLISH_PRIMARY_SUBTYPES
      : ENGLISH_MATRIC_SUBTYPES;
    if (map[id]) return { id, ...map[id] };
  }

  if (/اردو|اُردو|urdu/i.test(name) || /ردو/.test(name)) {
    const map = isPrimaryClassName(className)
      ? URDU_PRIMARY_SUBTYPES
      : URDU_MATRIC_SUBTYPES;
    if (map[id]) return { id, ...map[id] };
  }

  for (const row of PTS_SUBTYPE_BY_SUBJECT) {
    if (row.test.test(name) && row.map[id]) {
      return { id, ...row.map[id] };
    }
  }
  if (PTS_SUBTYPE_DEFAULT[id]) {
    return { id, ...PTS_SUBTYPE_DEFAULT[id] };
  }
  return {
    id,
    name: `subtype-${id}`,
    bankType: "short",
    field: `SUBTYPE_${id}`,
  };
}
