/**
 * Live PTS → Mongo Gen* seed for PTB Class 9 only.
 * READ-ONLY PTS calls: GetSyllabus / SubjectsList / ChaptersList / GetQuestions.
 * NEVER SavePaper / CreatePaper.
 *
 * Auth (one of):
 *   PTS_USER + PTS_PASS
 *   PTS_COOKIE  (full Cookie header from logged-in browser)
 *
 * Usage:
 *   node src/scripts/seedPtsLiveClass9.js
 *   node src/scripts/seedPtsLiveClass9.js biology
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";
import { logoForSubjectSlug } from "../constants/ptsSubjectLogos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, "../../data/lahore-board/9th");
const BASE = "https://www.paktestsolution.com";
const BOARD_NAME = "PTB";
const CLASS_NAME = "9TH";
const CLASS_ID = 9;
const PRIORITIES = [1, 2, 3, 4, 5];
const TOPIC_CHUNK = 8;
const MONGO_CHUNK = 400;
const ONLY_SLUG = process.argv[2] || null;

/** @type {Record<number, { slug: string; types: Array<{ id: number; name: string; bankType: 'mcq'|'short'|'long'; field: string }> }>} */
const SUBJECT_CONFIG = {
  43: {
    slug: "biology",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  44: {
    slug: "computer",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  45: {
    slug: "chemistry",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  46: {
    slug: "physics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  47: {
    slug: "mathematics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  48: {
    slug: "english",
    types: [
      { id: 1, name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
      { id: 2, name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
      { id: 3, name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
      { id: 5, name: "mcq-verb", bankType: "mcq", field: "VERB" },
      { id: 6, name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 15, name: "long-letters", bankType: "long", field: "LETTER" },
      { id: 21, name: "short-translate-en", bankType: "short", field: "TRANSLATE_EN" },
      { id: 22, name: "short-voice", bankType: "short", field: "VOICE" },
      { id: 26, name: "long-stories", bankType: "long", field: "STORY" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 31, name: "long-dialogues", bankType: "long", field: "DIALOGUE" },
      { id: 34, name: "short-word", bankType: "short", field: "WORD" },
      { id: 36, name: "short-idioms", bankType: "short", field: "IDIOM" },
      { id: 43, name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
      { id: 45, name: "long-comprehension-para", bankType: "long", field: "PASSAGE" },
      { id: 47, name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
    ],
  },
  50: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 24, name: "short-correct", bankType: "short", field: "CORRECT" },
      { id: 25, name: "short-idiom", bankType: "short", field: "IDIOM" },
      { id: 42, name: "short-meaning", bankType: "short", field: "MEANING" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
      { id: 15, name: "long-letter", bankType: "long", field: "LETTER" },
      { id: 16, name: "long-application", bankType: "long", field: "APPLICATION" },
      { id: 26, name: "long-story", bankType: "long", field: "STORY" },
      { id: 31, name: "long-dialogue", bankType: "long", field: "DIALOGUE" },
      { id: 30, name: "long-central", bankType: "long", field: "CENTRAL" },
    ],
  },
  51: {
    slug: "islamiyat-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
      { id: 57, name: "long-personality", bankType: "long", field: "PERSONALITY" },
    ],
  },
  52: {
    slug: "general-science",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  54: {
    slug: "education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  55: {
    slug: "punjabi",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 15, name: "long-letter", bankType: "long", field: "LETTER" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 26, name: "long-story", bankType: "long", field: "STORY" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 30, name: "long-central", bankType: "long", field: "CENTRAL" },
      { id: 34, name: "short-word", bankType: "short", field: "WORD" },
      { id: 37, name: "short-meaning", bankType: "short", field: "MEANING" },
      { id: 38, name: "singular-plural", bankType: "short", field: "VOCAB" },
      { id: 39, name: "gender", bankType: "short", field: "GENDER" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
    ],
  },
  56: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
      { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
    ],
  },
  57: {
    slug: "home-economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  58: {
    slug: "civics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  257: {
    slug: "economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  308: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
      { id: 37, name: "short-meaning", bankType: "short", field: "WORD" },
    ],
  },
  311: {
    slug: "ethics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  335: {
    slug: "physical-education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  339: {
    slug: "poultry",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  1536: {
    slug: "food-nutrition",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
};

const jar = new Map();

function storeCookies(res) {
  const anyRes = /** @type {Response & { headers: Headers & { getSetCookie?: () => string[] } }} */ (
    res
  );
  for (const c of anyRes.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader() {
  if (process.env.PTS_COOKIE?.trim()) return process.env.PTS_COOKIE.trim();
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(url, opts = {}) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    ...(opts.headers || {}),
  };
  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}

async function login() {
  if (process.env.PTS_COOKIE?.trim()) {
    await req(`${BASE}/GeneratePaper/GetSyllabus`);
    console.log("Using PTS_COOKIE session");
    return;
  }
  const USER = process.env.PTS_USER;
  const PASS = process.env.PTS_PASS;
  if (!USER || !PASS) {
    throw new Error(
      "Set PTS_USER+PTS_PASS or PTS_COOKIE for live PTS authentication"
    );
  }
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u.toString())).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in to PTS (read-only)");
}

async function getJson(apiPath, params = {}) {
  const u = new URL(BASE + apiPath);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await req(u.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`${apiPath} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function getQuestions(topicIds, subTypeId, priorityId) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  const res = await req(u.toString());
  if (!res.ok) return [];
  const json = JSON.parse(await res.text());
  return json.QuestionsList || [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fieldSource(field, priorityName) {
  switch (field) {
    case "SPELLING":
      return "Tick correct spelling";
    case "MEANING":
      return "Correct meaning of underlined word";
    case "VERB":
      return "Correct form of verb";
    case "PAIR":
      return "Pair of Words";
    case "SUMMARY":
      return "Summary";
    case "COMPREHENSION":
    case "QA":
    case "MCQ":
    case "LONG":
      return priorityName || "Exercise";
    case "GRAMMAR":
      return "Tick correct according to grammar";
    case "TRANSLATE_UR":
      return "Translate into Urdu";
    case "TRANSLATE_EN":
      return "Translate into English";
    case "POEM_STANZA":
    case "POEM":
      return "Poem Stanzas";
    case "AYAT":
      return "Ayat / Quranic text";
    case "HADITH":
      return "Hadith";
    case "PERSONALITY":
      return "Personalities";
    case "PASSAGE":
      return "Passage";
    case "WORD":
      return "Words Into Sentences";
    case "IDIOM":
      return "Idioms";
    case "CORRECT":
      return "Sentence correction";
    case "LETTER":
      return "Letters";
    case "APPLICATION":
      return "Application";
    case "STORY":
      return "Stories";
    case "DIALOGUE":
      return "Dialogues";
    case "CENTRAL":
      return "Central idea";
    case "VOICE":
      return "Active & Passive Voice";
    default:
      return priorityName || field || "Exercise";
  }
}

/** Keep RichText-compatible tags: underline, strong/em, sub/sup, imgs. */
const PTS_KEEP_TAGS = new Set([
  "img",
  "br",
  "sub",
  "sup",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "u",
]);

function stripHtmlKeepMedia(html) {
  if (!html) return "";
  let s = String(html);
  s = s
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br /><br />")
    .replace(/<p\b[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<\/div>\s*<div\b[^>]*>/gi, "<br /><br />")
    .replace(/<div\b[^>]*>/gi, "")
    .replace(/<\/div>/gi, "");
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs = "") => {
    const name = String(tag).toLowerCase();
    const closing = full.startsWith("</");
    if (!PTS_KEEP_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br />";
    if (name === "img") {
      const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
      let src = (srcMatch?.[2] || "").trim().replace(/\\/g, "/");
      if (!src) return "";
      if (src.startsWith("//")) src = `https:${src}`;
      const altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
      const alt = altMatch?.[2] ?? "";
      const styleMatch = attrs.match(/\sstyle\s*=\s*(["'])([^"']*)\1/i);
      const style = styleMatch?.[2]
        ? ` style="${styleMatch[2].replace(/"/g, "&quot;")}"`
        : "";
      return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}"${style} />`;
    }
    return `<${name}>`;
  });
  s = s
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&");
  return s.replace(/\r\n/g, "\n").trim();
}

function optionText(opt) {
  const en = stripHtmlKeepMedia(opt?.EmOption || "");
  const ur = stripHtmlKeepMedia(opt?.UmOption || "");
  if (en && ur && en !== ur) return `${en} / ${ur}`;
  return en || ur || "";
}

function correctLetter(options) {
  if (!Array.isArray(options)) return null;
  const idx = options.findIndex((o) => o.Answer === true);
  return idx >= 0 ? ["A", "B", "C", "D"][idx] ?? null : null;
}

function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bIn\b/g, "in")
    .replace(/\bFor\b/g, "for")
    .replace(/\bWith\b/g, "with")
    .replace(/\bThe\b/g, "the")
    .replace(/\bTo\b/g, "to")
    .replace(/\bA\b/g, "a");
}

function chapterNumber(chapterName, index) {
  const m = String(chapterName || "").match(
    /(?:CHAP(?:TER)?|UNIT|باب|باب نمبر)\s*(\d+)/i
  );
  if (m) return Number(m[1]);
  const m2 = String(chapterName || "").match(/^(\d+)\s*[:.\-]/);
  if (m2) return Number(m2[1]);
  return index + 1;
}

function chapterTitle(chapterName) {
  let t = String(chapterName || "")
    .replace(/^(?:CHAP(?:TER)?|UNIT)\s*\d+\s*:\s*/i, "")
    .replace(/^\d+\s*[:.\-]\s*/, "")
    .trim();
  if (/^[\x00-\x7F]+$/.test(t)) return titleCase(t);
  return t;
}

function topicCodeFromRef(ref, topicName, chapterNum, ti) {
  if (ref && /^\d+\.\d+[A-Za-z]?$/.test(String(ref).trim()))
    return String(ref).trim();
  const m = String(topicName || "").match(/(\d+)\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  if (/REVIEW/i.test(topicName || "")) return `${chapterNum}.R`;
  return `${chapterNum}.${ti + 1}`;
}

function mapType(type) {
  if (type === "long") return "LONG";
  if (type === "mcq") return "MCQ";
  return "SHORT";
}

function defaultMarks(type) {
  if (type === "LONG") return 5;
  if (type === "MCQ") return 1;
  return 2;
}

function topicOrder(topicId) {
  const part = String(topicId).split(".")[1];
  if (part === "R") return 99;
  const n = Number(part);
  return Number.isFinite(n) ? n : 0;
}

function resolveQuestionText(q) {
  const text = q.en?.trim();
  if (text && text !== ".") return text;
  if (q.field === "SPELLING") return "Tick the correct spelling.";
  if (q.type === "mcq") return q.source?.trim() || "Select the correct option.";
  return q.ur?.trim() || "";
}

function normalizeMcqOptions(q) {
  const letters = ["A", "B", "C", "D"];
  const raw = [q.optionA, q.optionB, q.optionC, q.optionD];
  const options = raw.map((value, index) => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    const letter = letters[index];
    if (q.correctAnswer?.toUpperCase() === letter) return "—";
    return null;
  });
  if (!q.correctAnswer || options.some((value) => !value)) return null;
  return {
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    correctAnswer: q.correctAnswer.toUpperCase(),
  };
}

function buildSyllabusAndQuestions(subject, cfg, hierarchy, rawByType) {
  const chapters = (hierarchy.ChaptersList || []).map((ch, i) => {
    const num = chapterNumber(ch.ChapterName, i);
    const title = chapterTitle(ch.ChapterName);
    const topics = (hierarchy.TopicsList || [])
      .filter((t) => t.ChapterID === ch.ChapterID)
      .map((t, ti) => {
        const id = topicCodeFromRef(t.TopicRef, t.TopicName, num, ti);
        let titleT = String(t.TopicName || "")
          .replace(/^\d+\.\d+\s*/, "")
          .replace(/^E\.X:\s*/i, "Exercise ")
          .trim();
        if (/REVIEW/i.test(t.TopicName || "")) titleT = `Review Exercise ${num}`;
        if (/^[\x00-\x7F]+$/.test(titleT)) titleT = titleCase(titleT);
        return { id, title: titleT || t.TopicName, _topicId: t.TopicID };
      });
    return { number: num, title, topics, _chapterId: ch.ChapterID };
  });

  const topicIdToCode = new Map();
  for (const ch of chapters) {
    for (const t of ch.topics) {
      topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
    }
  }

  function mapQuestion(raw, bankType, field) {
    const meta = topicIdToCode.get(raw.TopicID) || {
      code: String(raw.TopicRef || "0.0"),
      chapter: 0,
    };
    const en = stripHtmlKeepMedia(raw.EnglishQuestionDetails);
    const ur = stripHtmlKeepMedia(raw.UrduQuestionDetails);
    const sortedOpts = [...(raw.MultipleOptions || [])].sort(
      (a, b) => a.OptionID - b.OptionID
    );
    const priority = raw.QuestionPeriority || undefined;
    const q = {
      id: raw.QuestionID,
      chapter: meta.chapter,
      topic_id: meta.code,
      type: bankType,
      field,
      source: fieldSource(field, priority),
      priority,
      en: en || ur,
      ur: ur && ur !== en ? ur : undefined,
    };
    if (bankType === "mcq") {
      q.optionA = optionText(sortedOpts[0] || {});
      q.optionB = optionText(sortedOpts[1] || {});
      q.optionC = optionText(sortedOpts[2] || {});
      q.optionD = optionText(sortedOpts[3] || {});
      q.correctAnswer = correctLetter(sortedOpts) || undefined;
    }
    return q;
  }

  const questions = [];
  const counts = { mcq: 0, short: 0, long: 0 };
  const fieldCounts = {};

  for (const type of cfg.types) {
    for (const raw of rawByType[type.name] || []) {
      const mapped = mapQuestion(raw, type.bankType, type.field);
      questions.push(mapped);
      counts[type.bankType] = (counts[type.bankType] || 0) + 1;
      fieldCounts[type.field] = (fieldCounts[type.field] || 0) + 1;
    }
  }

  const syllabus = {
    board: "Lahore",
    class: "9",
    subject: subject.SubjectName,
    slug: cfg.slug,
    chapters: chapters.map(({ number, title, topics }) => ({
      number,
      title,
      topics: topics.map(({ id, title: t }) => ({ id, title: t })),
    })),
  };

  const allQuestions = {
    board: "Lahore",
    class: "9",
    subject: subject.SubjectName,
    slug: cfg.slug,
    source: `PTS PTB Class 9 ${subject.SubjectName} (live seed ${new Date().toISOString()})`,
    total_questions: questions.length,
    counts,
    fieldCounts,
    questions,
  };

  return { syllabus, allQuestions, chapters, counts, fieldCounts };
}

async function upsertSubjectToMongo(syllabus, allQuestions) {
  const slug = syllabus.slug;
  const subjectName = syllabus.subject;
  const keyPrefix = `punjab-textbook:9:${slug}:`;

  let board = await GenBoard.findOne({ name: BOARD_NAME });
  if (!board) {
    board = await GenBoard.create({
      name: BOARD_NAME,
      code: "PTB",
      subtitle: "Syllabus",
      ptsCourseId: 1,
      sortOrder: 1,
    });
  }

  let klass = await GenClass.findOne({ board: board._id, name: CLASS_NAME });
  if (!klass) {
    klass = await GenClass.create({
      board: board._id,
      name: CLASS_NAME,
      gradeLevel: 9,
      ptsClassId: 9,
    });
  }

  const imageUrl = logoForSubjectSlug(slug);
  let subject = await GenSubject.findOne({ class: klass._id, slug });
  if (!subject) {
    subject = await GenSubject.create({
      class: klass._id,
      name: subjectName,
      slug,
      imageUrl,
    });
  } else {
    let dirty = false;
    if (subject.name !== subjectName) {
      subject.name = subjectName;
      dirty = true;
    }
    if (imageUrl && subject.imageUrl !== imageUrl) {
      subject.imageUrl = imageUrl;
      dirty = true;
    }
    if (dirty) await subject.save();
  }

  const topicIdByCode = new Map();
  for (const chapterData of syllabus.chapters || []) {
    const chapterName = `${chapterData.number}. ${chapterData.title}`;
    let chapter = await GenChapter.findOne({
      subject: subject._id,
      name: chapterName,
    });
    if (!chapter) {
      chapter = await GenChapter.create({
        subject: subject._id,
        name: chapterName,
        order: chapterData.number,
      });
    } else {
      chapter.order = chapterData.number;
      await chapter.save();
    }

    for (const topicData of chapterData.topics || []) {
      const topicName = `${topicData.id} ${topicData.title}`;
      let topic = await GenTopic.findOne({
        chapter: chapter._id,
        name: topicName,
      });
      if (!topic) {
        topic = await GenTopic.create({
          chapter: chapter._id,
          name: topicName,
          order: topicOrder(topicData.id),
          code: topicData.id,
        });
      } else {
        topic.order = topicOrder(topicData.id);
        topic.code = topicData.id;
        await topic.save();
      }
      topicIdByCode.set(`${chapterData.number}:${topicData.id}`, topic);
      if (!topicIdByCode.has(topicData.id)) {
        topicIdByCode.set(topicData.id, topic);
      }
    }
  }

  const existing = await GenQuestion.find({
    externalKey: {
      $regex: `^${keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    },
  })
    .select("_id externalKey")
    .lean();
  const existingByKey = new Map(
    existing.filter((r) => r.externalKey).map((r) => [r.externalKey, r._id])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
  const toCreate = [];

  for (const q of allQuestions.questions || []) {
    const topic =
      topicIdByCode.get(`${q.chapter}:${q.topic_id}`) ||
      topicIdByCode.get(q.topic_id);
    const text = resolveQuestionText(q);
    if (!topic || !text) {
      skipped += 1;
      continue;
    }

    const type = mapType(q.type);
    const subType = (q.field || type).toUpperCase();
    let mcqOptions = null;
    if (type === "MCQ") {
      mcqOptions = normalizeMcqOptions(q);
      if (!mcqOptions) {
        skipped += 1;
        continue;
      }
    }

    const externalKey = `${keyPrefix}${subType.toLowerCase()}:${q.id}`;
    const payload = {
      type,
      subType,
      text,
      textUrdu: q.ur?.trim() || null,
      optionA: mcqOptions?.optionA ?? null,
      optionB: mcqOptions?.optionB ?? null,
      optionC: mcqOptions?.optionC ?? null,
      optionD: mcqOptions?.optionD ?? null,
      correctAnswer: mcqOptions?.correctAnswer ?? q.correctAnswer ?? null,
      marks: defaultMarks(type),
      source: q.source ?? q.priority ?? null,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey,
    };

    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const existingId = existingByKey.get(externalKey);
    if (existingId) {
      await GenQuestion.updateOne({ _id: existingId }, { $set: payload });
      updated += 1;
    } else {
      toCreate.push(payload);
    }
  }

  for (let i = 0; i < toCreate.length; i += MONGO_CHUNK) {
    const chunk = toCreate.slice(i, i + MONGO_CHUNK);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) {
        created += chunk.length - err.writeErrors.length;
      } else if (err?.code === 11000) {
        created += err.result?.nInserted || 0;
      } else {
        throw err;
      }
    }
  }

  return { created, updated, skipped, typeCounts };
}

async function seedSubject(subject, cfg) {
  console.log(`\n=== Class 9 ${subject.SubjectName} (${cfg.slug}) ===`);

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subject.SubjectID,
  });
  const topics = hierarchy.TopicsList || [];
  if (!topics.length) {
    console.warn("  No topics — skip");
    return null;
  }

  const outDir = path.join(DATA_ROOT, cfg.slug);
  const rawDir = path.join(outDir, "pts-raw");
  fs.mkdirSync(rawDir, { recursive: true });

  fs.writeFileSync(
    path.join(rawDir, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: CLASS_ID },
        subject,
        slug: cfg.slug,
        exportTypes: cfg.types,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
      null,
      2
    )
  );

  /** @type {Record<string, any[]>} */
  const rawByType = {};
  const typeTotals = {};

  for (const type of cfg.types) {
    const bucket = [];
    const seen = new Set();
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += TOPIC_CHUNK) {
        const chunk = topics.slice(i, i + TOPIC_CHUNK);
        const ids = chunk.map((t) => t.TopicID).join(",");
        process.stdout.write(
          `\r  ${type.name} pri=${pri} topics ${i + 1}-${Math.min(i + TOPIC_CHUNK, topics.length)}/${topics.length}   `
        );
        let list = [];
        try {
          list = await getQuestions(ids, type.id, pri);
        } catch (e) {
          console.warn("\n", e.message);
        }
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          bucket.push({
            ...q,
            _exportMeta: {
              subTypeId: type.id,
              bankType: type.bankType,
              field: type.field,
              exportName: type.name,
            },
          });
        }
        await sleep(80);
      }
    }
    console.log("");
    rawByType[type.name] = bucket;
    typeTotals[type.name] = bucket.length;

    fs.writeFileSync(
      path.join(rawDir, `${type.name}-raw.json`),
      JSON.stringify(
        {
          board: "Lahore",
          course: "PTB",
          class: "9",
          subject: subject.SubjectName,
          slug: cfg.slug,
          type: type.bankType,
          field: type.field,
          exportName: type.name,
          subTypeId: type.id,
          total: bucket.length,
          exportedAt: new Date().toISOString(),
          source: "paktestsolution.com AjaxCalling/GetQuestions (live seed)",
          questions: bucket,
        },
        null,
        2
      )
    );
    console.log(`  Fetched ${type.name}: ${bucket.length}`);
  }

  const built = buildSyllabusAndQuestions(subject, cfg, hierarchy, rawByType);
  fs.writeFileSync(
    path.join(outDir, "syllabus.json"),
    JSON.stringify(built.syllabus, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "all-questions.json"),
    JSON.stringify(built.allQuestions, null, 2)
  );

  const mongo = await upsertSubjectToMongo(built.syllabus, built.allQuestions);
  console.log(
    `  Mongo +${mongo.created} ~${mongo.updated} skip ${mongo.skipped}`,
    mongo.typeCounts
  );

  return {
    slug: cfg.slug,
    name: subject.SubjectName,
    subjectId: subject.SubjectID,
    chapters: built.syllabus.chapters.length,
    topics: topics.length,
    typeTotals,
    counts: built.counts,
    fieldCounts: built.fieldCounts,
    total: built.allQuestions.total_questions,
    mongo,
  };
}

async function main() {
  await login();
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Mongo connected:", process.env.MONGO_URI);

  const subjects =
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: CLASS_ID }))
      .SubjectsList || [];

  console.log(`PTS Class 9 subjects listed: ${subjects.length}`);

  const summary = [];
  for (const sub of subjects) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (!cfg) {
      console.warn(`No config for subject ${sub.SubjectID} ${sub.SubjectName}`);
      continue;
    }
    if (ONLY_SLUG && cfg.slug !== ONLY_SLUG) continue;
    const result = await seedSubject(sub, cfg);
    if (result) summary.push(result);
  }

  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const summaryPath = path.join(DATA_ROOT, "_live-seed-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const totalQ = summary.reduce((a, s) => a + (s.total || 0), 0);
  const written = summary.reduce(
    (a, s) => a + (s.mongo?.created || 0) + (s.mongo?.updated || 0),
    0
  );
  console.log("\n═══ CLASS 9 LIVE SEED DONE ═══");
  console.log(`Subjects: ${summary.length}`);
  console.log(`Questions fetched: ${totalQ}`);
  console.log(`Mongo written: ${written}`);
  console.log(`Summary: ${summaryPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
