/**
 * Live PTS → Mongo Gen* bank for ALL boards/classes/subjects.
 * READ-ONLY: SubjectsList / ChaptersList / GetQuestions. Never SavePaper.
 *
 * Discovers every QuestionSubTypeID that returns data (probe 1–80 + known map).
 * Preserves punctuation, underline, sub/sup, and diagram/equation <img> tags.
 * Downloads missing equation/diagram assets into pts-media.
 *
 * Auth: PTS_USER+PTS_PASS or PTS_COOKIE
 *
 * Usage:
 *   node src/scripts/seedPtsLiveBank.js
 *   node src/scripts/seedPtsLiveBank.js --board PTB --class 9
 *   node src/scripts/seedPtsLiveBank.js --board PTB --class 6 --subject mathematics
 *   node src/scripts/seedPtsLiveBank.js --resume
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
import { PTS_BOARD_CATALOG } from "../constants/ptsBoardsCatalog.js";
import { logoForSubjectSlug } from "../constants/ptsSubjectLogos.js";
import {
  PTS_SUBTYPE_PROBE_IDS,
  resolvePtsSubType,
} from "../constants/ptsQuestionSubTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.paktestsolution.com";
const DATA_ROOT = path.resolve(__dirname, "../../data/pts-live");
const PROGRESS_PATH = path.join(DATA_ROOT, "_progress.json");
const MEDIA_ROOT = path.resolve(
  __dirname,
  "../../../_compare_Test_System/public/pts-media"
);
const PRIORITIES = [1, 2, 3, 4, 5];
const TOPIC_CHUNK = 24;
const MONGO_CHUNK = 400;
const SLEEP_MS = Number(process.env.PTS_SLEEP_MS || 12);
const CONCURRENCY = Math.max(1, Number(process.env.PTS_CONCURRENCY || 6));
const ALLOWED_TAGS = new Set([
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

const args = parseArgs(process.argv.slice(2));
const jar = new Map();

function parseArgs(argv) {
  const out = {
    board: null,
    class: null,
    subject: null,
    resume: false,
    probeMax: 80,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--board") out.board = String(argv[++i] || "").toUpperCase();
    else if (a === "--class") out.class = String(argv[++i] || "").toUpperCase();
    else if (a === "--subject") out.subject = String(argv[++i] || "").toLowerCase();
    else if (a === "--resume") out.resume = true;
    else if (a === "--probe-max") out.probeMax = Number(argv[++i]) || 80;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run async work over items with a fixed concurrency limit. */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
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

async function login(tries = 5) {
  let lastErr = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      if (process.env.PTS_COOKIE?.trim()) {
        await req(`${BASE}/GeneratePaper/GetSyllabus`);
        console.log("Using PTS_COOKIE session");
        return;
      }
      const USER = process.env.PTS_USER;
      const PASS = process.env.PTS_PASS;
      if (!USER || !PASS) {
        throw new Error("Set PTS_USER+PTS_PASS or PTS_COOKIE");
      }
      const u = new URL(`${BASE}/Home/CheckLogin`);
      u.searchParams.set("emailAddress", USER);
      u.searchParams.set("password", PASS);
      const json = await (await req(u.toString())).json();
      if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
      await req(`${BASE}${json.html}`);
      await req(`${BASE}/GeneratePaper/GetSyllabus`);
      console.log("Logged in to PTS (read-only)");
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`Login attempt ${attempt}/${tries} failed: ${err.message || err}`);
      await sleep(1000 * attempt);
    }
  }
  throw lastErr || new Error("Login failed");
}

async function getJson(apiPath, params = {}) {
  const u = new URL(BASE + apiPath);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await req(u.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`${apiPath} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function getQuestions(topicIds, subTypeId, priorityId, tries = 3) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  let lastErr = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await req(u.toString());
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(120 * attempt);
        continue;
      }
      const json = JSON.parse(await res.text());
      return json.QuestionsList || [];
    } catch (err) {
      lastErr = err;
      await sleep(180 * attempt);
    }
  }
  console.warn(
    `\n  fetch failed subtype=${subTypeId} pri=${priorityId}: ${lastErr?.message || lastErr}`
  );
  return [];
}

function slugify(name) {
  const s = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return s || "subject";
}

/** Keep RichText-compatible HTML: imgs, underline, sub/sup, punctuation entities. */
function preservePtsHtml(html) {
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
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br />";
    if (name === "img") {
      const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
      let src = (srcMatch?.[2] || "").trim().replace(/\\/g, "/");
      if (!src) return "";
      if (src.startsWith("//")) src = `https:${src}`;
      if (src.startsWith("/")) {
        /* keep site-relative for RichText rewrite + media download */
      } else if (!/^https?:\/\//i.test(src)) {
        src = `/${src.replace(/^\.?\/?/, "")}`;
      }
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
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return s.replace(/\r\n/g, "\n").trim();
}

function optionText(opt) {
  const en = preservePtsHtml(opt?.EmOption || "");
  const ur = preservePtsHtml(opt?.UmOption || "");
  if (en && ur && en !== ur) return `${en} / ${ur}`;
  return en || ur || "";
}

function correctLetter(options) {
  if (!Array.isArray(options)) return null;
  const idx = options.findIndex((o) => o.Answer === true);
  return idx >= 0 ? ["A", "B", "C", "D"][idx] ?? null : null;
}

function fieldSource(field, priorityName) {
  const map = {
  SPELLING: "Tick correct spelling",
  MEANING: "Correct meaning of underlined word",
  VERB: "Correct form of verb",
  PAIR: "Pair of Words",
  SUMMARY: "Summary",
  GRAMMAR: "Tick correct according to grammar",
  TRANSLATE_UR: "Translate into Urdu",
  TRANSLATE_EN: "Translate into English",
  POEM_STANZA: "Poem Stanzas",
  POEM: "Poem Stanzas",
  AYAT: "Ayat / Quranic text",
  HADITH: "Hadith",
  PERSONALITY: "Personalities",
  PASSAGE: "Passage",
  WORD: "Words Into Sentences",
  IDIOM: "Idioms",
  CORRECT: "Sentence correction",
  LETTER: "Letters",
  APPLICATION: "Application",
  STORY: "Stories",
  DIALOGUE: "Dialogues",
  CENTRAL: "Central idea",
  VOICE: "Active & Passive Voice",
  FILL: "Fill in the blanks",
  TRUE_FALSE: "True / False",
  MATCH: "Matching",
  SEQUENCE: "Sequence / Order",
  };
  return map[field] || priorityName || field || "Exercise";
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

function topicOrder(topicId) {
  const part = String(topicId).split(".")[1];
  if (part === "R") return 99;
  const n = Number(part);
  return Number.isFinite(n) ? n : 0;
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

function loadProgress() {
  try {
    let raw = fs.readFileSync(PROGRESS_PATH);
    /* PowerShell Set-Content -Encoding UTF8 writes a BOM that breaks JSON.parse */
    if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
      raw = raw.subarray(3);
    }
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return { done: {} };
  }
}

function saveProgress(progress) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function extractMediaPaths(...htmls) {
  const out = new Set();
  for (const html of htmls) {
    const s = String(html || "");
    for (const m of s.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      out.add(m[1]);
    }
  }
  return [...out];
}

function mediaLocalPath(src) {
  let s = String(src || "").trim().replace(/\\/g, "/");
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  if (s.startsWith("/pts-media/")) s = s.slice("/pts-media".length);
  if (s.startsWith("/Equations/")) {
    return path.join(MEDIA_ROOT, "equations", s.slice("/Equations/".length));
  }
  if (s.startsWith("/equations/")) {
    return path.join(MEDIA_ROOT, "equations", s.slice("/equations/".length));
  }
  if (s.startsWith("/Diagrams/")) {
    return path.join(MEDIA_ROOT, "Diagrams", s.slice("/Diagrams/".length));
  }
  if (s.startsWith("/Images/")) {
    return path.join(MEDIA_ROOT, "Images", s.slice("/Images/".length));
  }
  if (s.startsWith("/images/")) {
    return path.join(MEDIA_ROOT, "images", s.slice("/images/".length));
  }
  return null;
}

async function ensureMediaFiles(paths) {
  let downloaded = 0;
  for (const src of paths) {
    const local = mediaLocalPath(src);
    if (!local) continue;
    if (fs.existsSync(local)) continue;
    let urlPath = String(src).replace(/\\/g, "/");
    if (/^https?:\/\//i.test(urlPath)) {
      /* absolute */
    } else {
      if (!urlPath.startsWith("/")) urlPath = `/${urlPath}`;
      urlPath = BASE + urlPath;
    }
    try {
      fs.mkdirSync(path.dirname(local), { recursive: true });
      const res = await req(urlPath);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 16) continue;
      fs.writeFileSync(local, buf);
      downloaded += 1;
      await sleep(20);
    } catch {
      /* keep going — question HTML still has src */
    }
  }
  return downloaded;
}

function inferBankType(meta, sampleQuestions) {
  if (meta.bankType && meta.field !== `SUBTYPE_${meta.id}`) return meta;
  const sample = sampleQuestions?.[0];
  if (!sample) return meta;
  const hasOpts =
    Array.isArray(sample.MultipleOptions) && sample.MultipleOptions.length > 0;
  if (hasOpts) {
    return {
      ...meta,
      bankType: "mcq",
      field: meta.field.startsWith("SUBTYPE_") ? "MCQ" : meta.field,
      name: meta.name.startsWith("subtype-") ? "mcq" : meta.name,
    };
  }
  if (sample.TrueFalseAnswer === true || sample.TrueFalseAnswer === false) {
    return { ...meta, bankType: "short", field: "TRUE_FALSE", name: "true-false" };
  }
  if (sample.EnglishFillAnswer || sample.UrduFillAnswer) {
    return { ...meta, bankType: "short", field: "FILL", name: "fill" };
  }
  const en = String(sample.EnglishQuestionDetails || "");
  const ur = String(sample.UrduQuestionDetails || "");
  if (/\.{4,}|_{3,}|…{2,}/.test(en + ur)) {
    return { ...meta, bankType: "short", field: "FILL", name: "fill" };
  }
  const longish = en.length > 400 || ur.length > 400;
  if (longish) {
    return {
      ...meta,
      bankType: "long",
      field: meta.field.startsWith("SUBTYPE_") ? "LONG" : meta.field,
    };
  }
  return meta;
}

async function discoverTypes(subjectName, className, topics) {
  const probeIds = PTS_SUBTYPE_PROBE_IDS.filter((id) => id <= args.probeMax);
  /* One TopicIDs blob — discover does not need chunking (much fewer calls). */
  const allIds = topics.map((t) => t.TopicID).join(",");
  let hitCount = 0;

  const results = await mapPool(probeIds, CONCURRENCY, async (id) => {
    let hitList = null;
    /* Some primary types only appear on priority 3+ — probe all priorities. */
    for (const pri of PRIORITIES) {
      const list = await getQuestions(allIds, id, pri, 2);
      if (SLEEP_MS) await sleep(SLEEP_MS);
      if (list.length) {
        hitList = list;
        break;
      }
    }
    if (!hitList) return null;
    let meta = resolvePtsSubType(subjectName, id, className);
    if (String(meta.field || "").startsWith("SUBTYPE_")) {
      meta = inferBankType(meta, hitList);
    }
    hitCount += 1;
    process.stdout.write(`\r  discover types: ${hitCount} hit (last ${id})   `);
    return meta;
  });

  console.log("");
  return results.filter(Boolean);
}

function buildSyllabus(subject, slug, hierarchy) {
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
  return {
    subject: subject.SubjectName,
    slug,
    chapters: chapters.map(({ number, title, topics }) => ({
      number,
      title,
      topics: topics.map(({ id, title: t }) => ({ id, title: t })),
    })),
    _chapters: chapters,
  };
}

function mapQuestion(raw, bankType, field, topicIdToCode) {
  const meta = topicIdToCode.get(raw.TopicID) || {
    code: String(raw.TopicRef || "0.0"),
    chapter: 0,
  };
  const en = preservePtsHtml(raw.EnglishQuestionDetails);
  const ur = preservePtsHtml(raw.UrduQuestionDetails);
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
  const present = raw.filter((v) => String(v || "").trim()).length;
  if (present < 2) return null;
  const options = raw.map((value, index) => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    const letter = letters[index];
    if (q.correctAnswer?.toUpperCase() === letter) return "—";
    return "—";
  });
  if (!q.correctAnswer) return null;
  return {
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    correctAnswer: q.correctAnswer.toUpperCase(),
  };
}

async function upsertToMongo({
  boardEntry,
  classEntry,
  subjectPts,
  slug,
  syllabus,
  questions,
  types,
}) {
  let board = await GenBoard.findOne({ ptsCourseId: boardEntry.ptsCourseId });
  if (!board) board = await GenBoard.findOne({ name: boardEntry.name });
  if (!board) {
    board = await GenBoard.create({
      name: boardEntry.name,
      code: boardEntry.code,
      subtitle: boardEntry.subtitle,
      ptsCourseId: boardEntry.ptsCourseId,
      imageUrl: boardEntry.imageUrl,
      sortOrder: boardEntry.sortOrder,
    });
  }

  let klass = await GenClass.findOne({
    board: board._id,
    ptsClassId: classEntry.ptsClassId,
  });
  if (!klass) {
    klass = await GenClass.findOne({ board: board._id, name: classEntry.name });
  }
  if (!klass) {
    klass = await GenClass.create({
      board: board._id,
      name: classEntry.name,
      gradeLevel: classEntry.gradeLevel ?? null,
      ptsClassId: classEntry.ptsClassId,
    });
  }

  const imageUrl =
    subjectPts.ImageUrl && String(subjectPts.ImageUrl).startsWith("http")
      ? subjectPts.ImageUrl
      : subjectPts.ImageUrl
        ? `${BASE}${subjectPts.ImageUrl}`
        : logoForSubjectSlug(slug) || "";

  let subject =
    (await GenSubject.findOne({ class: klass._id, slug })) ||
    (await GenSubject.findOne({
      class: klass._id,
      name: subjectPts.SubjectName,
    }));
  if (!subject) {
    subject = await GenSubject.create({
      class: klass._id,
      name: subjectPts.SubjectName,
      slug,
      imageUrl,
    });
  } else {
    let dirty = false;
    if (subject.name !== subjectPts.SubjectName) {
      subject.name = subjectPts.SubjectName;
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
    } else if (chapter.order !== chapterData.number) {
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
      if (!topicIdByCode.has(topicData.id)) topicIdByCode.set(topicData.id, topic);
    }
  }

  const keyPrefix = `pts:${classEntry.ptsClassId}:${subjectPts.SubjectID}:`;
  const existing = await GenQuestion.find({ subject: subject._id })
    .select("_id externalKey")
    .lean();
  const existingByKey = new Map();
  const existingByQid = new Map();
  for (const r of existing) {
    if (!r.externalKey) continue;
    existingByKey.set(r.externalKey, r._id);
    const m = String(r.externalKey).match(/:(\d+)$/);
    if (m && !existingByQid.has(m[1])) existingByQid.set(m[1], r._id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
  const toCreate = [];

  for (const q of questions) {
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
    const externalKey = `${keyPrefix}${q.subTypeId}:${q.id}`;
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
    const existingId =
      existingByKey.get(externalKey) || existingByQid.get(String(q.id));
    if (existingId) {
      await GenQuestion.updateOne({ _id: existingId }, { $set: payload });
      updated += 1;
      existingByKey.set(externalKey, existingId);
      existingByQid.set(String(q.id), existingId);
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
      if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
      else if (err?.code === 11000) created += err.result?.nInserted || 0;
      else throw err;
    }
  }

  return { created, updated, skipped, typeCounts, types: types.map((t) => t.field) };
}

async function seedSubject(boardEntry, classEntry, subjectPts, progress) {
  const key = `${boardEntry.ptsCourseId}:${classEntry.ptsClassId}:${subjectPts.SubjectID}`;
  const prev = progress.done[key];
  if (args.resume && prev && !prev.error && prev.total != null) {
    console.log(`  skip (resume) ${subjectPts.SubjectName} (${prev.total} q)`);
    return null;
  }

  const slug = slugify(subjectPts.SubjectName);
  console.log(
    `\n=== ${boardEntry.name} / ${classEntry.name} / ${subjectPts.SubjectName} (${slug}) ===`
  );

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subjectPts.SubjectID,
  });
  const topics = hierarchy.TopicsList || [];
  if (!topics.length) {
    console.warn("  No topics — mark done");
    progress.done[key] = { total: 0, reason: "no-topics" };
    saveProgress(progress);
    return null;
  }

  const types = await discoverTypes(
    subjectPts.SubjectName,
    classEntry.name,
    topics
  );
  if (!types.length) {
    console.warn("  No question subtypes with data — mark done");
    progress.done[key] = { total: 0, reason: "no-types" };
    saveProgress(progress);
    return null;
  }
  console.log(
    `  types: ${types.map((t) => `${t.id}:${t.field}`).join(", ")}`
  );

  const syllabusBuilt = buildSyllabus(subjectPts, slug, hierarchy);
  const topicIdToCode = new Map();
  for (const ch of syllabusBuilt._chapters) {
    for (const t of ch.topics) {
      topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
    }
  }

  const questions = [];
  const media = new Set();
  const typeTotals = {};

  for (const type of types) {
    const seen = new Set();
    const jobs = [];
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += TOPIC_CHUNK) {
        const chunk = topics.slice(i, i + TOPIC_CHUNK);
        jobs.push({
          pri,
          from: i + 1,
          to: Math.min(i + TOPIC_CHUNK, topics.length),
          ids: chunk.map((t) => t.TopicID).join(","),
        });
      }
    }
    let doneJobs = 0;
    await mapPool(jobs, CONCURRENCY, async (job) => {
      process.stdout.write(
        `\r  ${type.field} ${++doneJobs}/${jobs.length} pri=${job.pri} topics ${job.from}-${job.to}/${topics.length}   `
      );
      let list = [];
      try {
        list = await getQuestions(job.ids, type.id, job.pri);
      } catch (e) {
        console.warn("\n", e.message);
      }
      if (SLEEP_MS) await sleep(SLEEP_MS);
      for (const raw of list) {
        if (seen.has(raw.QuestionID)) continue;
        seen.add(raw.QuestionID);
        for (const p of extractMediaPaths(
          raw.EnglishQuestionDetails,
          raw.UrduQuestionDetails,
          ...(raw.MultipleOptions || []).flatMap((o) => [
            o.EmOption,
            o.UmOption,
          ])
        )) {
          media.add(p);
        }
        const mapped = mapQuestion(raw, type.bankType, type.field, topicIdToCode);
        mapped.subTypeId = type.id;
        questions.push(mapped);
      }
    });
    console.log("");
    typeTotals[type.field] = seen.size;
    console.log(`  fetched ${type.field}: ${seen.size}`);
  }

  /* Per-chapter × type counts (must match PTS for selected chapters). */
  const chapterTypeCounts = {};
  for (const q of questions) {
    const ch = q.chapter || 0;
    const f = q.field || "?";
    if (!chapterTypeCounts[ch]) chapterTypeCounts[ch] = {};
    chapterTypeCounts[ch][f] = (chapterTypeCounts[ch][f] || 0) + 1;
  }
  console.log(
    `  chapter×type matrix: ${Object.keys(chapterTypeCounts).length} chapters, ${questions.length} questions`
  );

  const mediaDl = await ensureMediaFiles([...media]);
  if (media.size) console.log(`  media paths ${media.size}, downloaded ${mediaDl}`);

  const outDir = path.join(
    DATA_ROOT,
    boardEntry.code,
    String(classEntry.ptsClassId),
    slug
  );
  fs.mkdirSync(path.join(outDir, "pts-raw"), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "pts-raw", "hierarchy.json"),
    JSON.stringify(
      {
        course: boardEntry,
        class: classEntry,
        subject: subjectPts,
        types,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outDir, "syllabus.json"),
    JSON.stringify(
      {
        board: boardEntry.name,
        class: classEntry.name,
        subject: subjectPts.SubjectName,
        slug,
        chapters: syllabusBuilt.chapters,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outDir, "all-questions.json"),
    JSON.stringify(
      {
        board: boardEntry.name,
        class: classEntry.name,
        subject: subjectPts.SubjectName,
        slug,
        types,
        typeTotals,
        total_questions: questions.length,
        exportedAt: new Date().toISOString(),
        questions,
      },
      null,
      2
    )
  );

  const mongo = await upsertToMongo({
    boardEntry,
    classEntry,
    subjectPts,
    slug,
    syllabus: syllabusBuilt,
    questions,
    types,
  });
  console.log(
    `  Mongo +${mongo.created} ~${mongo.updated} skip ${mongo.skipped}`,
    mongo.typeCounts
  );

  progress.done[key] = {
    slug,
    total: questions.length,
    typeTotals,
    chapterTypeCounts,
    types: types.map((t) => ({ id: t.id, field: t.field })),
    mongo,
    at: new Date().toISOString(),
  };
  saveProgress(progress);
  return progress.done[key];
}

async function main() {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  await login();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI / MONGO_URI missing");
  await mongoose.connect(uri);
  console.log("Mongo connected");

  const progress = loadProgress();
  if (!args.resume) {
    /* keep prior progress keys; only skip when --resume */
  }

  let boards = PTS_BOARD_CATALOG.filter((b) => b.ptsCourseId != null);
  if (args.board) {
    boards = boards.filter(
      (b) =>
        b.code.toUpperCase() === args.board ||
        b.name.toUpperCase() === args.board
    );
  }

  for (const boardEntry of boards) {
    let classes = boardEntry.classes || [];
    if (args.class) {
      classes = classes.filter(
        (c) =>
          String(c.name).toUpperCase() === args.class ||
          String(c.ptsClassId) === args.class ||
          String(c.gradeLevel) === args.class
      );
    }

    for (const classEntry of classes) {
      if (classEntry.ptsClassId == null) continue;
      console.log(
        `\n######## ${boardEntry.name} / ${classEntry.name} (ClassID ${classEntry.ptsClassId}) ########`
      );
      let subjects = [];
      try {
        let lastErr = null;
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          try {
            subjects =
              (
                await getJson("/AjaxCalling/SubjectsListByClassID", {
                  ClassID: classEntry.ptsClassId,
                })
              ).SubjectsList || [];
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            console.warn(
              `  SubjectsList attempt ${attempt}/5 failed: ${err.message || err}`
            );
            await sleep(1500 * attempt);
          }
        }
        if (lastErr) throw lastErr;
      } catch (err) {
        console.error(
          `  ERROR class ${classEntry.name} SubjectsList:`,
          err.message || err
        );
        continue;
      }

      for (const sub of subjects) {
        const slug = slugify(sub.SubjectName);
        if (args.subject && slug !== args.subject && !slug.includes(args.subject)) {
          continue;
        }
        try {
          await seedSubject(boardEntry, classEntry, sub, progress);
        } catch (err) {
          console.error(
            `  ERROR ${sub.SubjectName}:`,
            err.message || err
          );
          progress.done[
            `${boardEntry.ptsCourseId}:${classEntry.ptsClassId}:${sub.SubjectID}`
          ] = {
            error: String(err.message || err),
            at: new Date().toISOString(),
          };
          saveProgress(progress);
        }
      }
    }
  }

  console.log("\nAll requested subjects finished.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
