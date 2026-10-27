/**
 * Sync Class 12 اسلامیات اختیاری missing PTS type: LONG (13).
 * Priorities 1+2+3 (matches live compare). Does not touch MCQ/QA.
 *
 *   node --dns-result-order=ipv4first src/scripts/syncIslamiyatElective12MissingLong.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(
  __dirname,
  "../../data/lahore-board/12th/islamiyat-elective/pts-raw"
);
const ALL_Q = path.resolve(
  __dirname,
  "../../data/lahore-board/12th/islamiyat-elective/all-questions.json"
);
const LONG_Q = path.resolve(
  __dirname,
  "../../data/lahore-board/12th/islamiyat-elective/long-questions.json"
);
const LIVE_DIR = path.resolve(
  __dirname,
  "../../data/pts-live/PTB/12/islamiyat-elective"
);
const BASE = "https://www.paktestsolution.com";
const SUBJECT_ID = 133;
const KEY_PREFIX = "pts:12:133:";
const PRIORITIES = [1, 2, 3];
const TYPE_DEF = {
  id: 13,
  field: "LONG",
  bankType: "long",
  name: "long",
  file: "long-raw.json",
};

const jar = new Map();
function storeCookies(res) {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const line of raw) {
    const part = String(line).split(";")[0];
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function req(url) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (process.env.PTS_COOKIE?.trim()) {
    headers.Cookie = process.env.PTS_COOKIE.trim();
  } else if (jar.size) {
    headers.Cookie = cookieHeader();
  }
  const res = await fetch(url, { headers, redirect: "manual" });
  storeCookies(res);
  return res;
}
async function login() {
  if (process.env.PTS_COOKIE?.trim()) {
    await req(`${BASE}/GeneratePaper/GetSyllabus`);
    console.log("PTS cookie OK");
    return;
  }
  const USER = process.env.PTS_USER?.trim();
  const PASS = process.env.PTS_PASS?.trim();
  if (!USER || !PASS) throw new Error("Set PTS_USER+PTS_PASS");
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u.toString())).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("PTS login OK");
}

const KEEP = new Set([
  "img", "br", "sub", "sup", "span", "strong", "em", "b", "i", "u",
]);
function preservePtsHtml(html) {
  if (!html) return "";
  let s = String(html);
  s = s.replace(
    /<span\b([^>]*?)\bstyle\s*=\s*(["'])([^"']*text-decoration\s*:\s*underline[^"']*)\2([^>]*)>([\s\S]*?)<\/span>/gi,
    "<u>$5</u>"
  );
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
    if (!KEEP.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br />";
    if (name === "img") {
      const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
      let src = (srcMatch?.[2] || "").trim().replace(/\\/g, "/");
      if (!src) return "";
      if (src.startsWith("//")) src = `https:${src}`;
      return `<img src="${src.replace(/"/g, "&quot;")}" alt="" />`;
    }
    return `<${name}>`;
  });
  return s
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n/g, "\n")
    .trim();
}
function normalizeName(s) {
  return String(s || "")
    .replace(/^\d+(\.\d+)?\s*/, "")
    .replace(/["""«»]/g, "")
    .trim()
    .toLowerCase();
}
function priorityLabel(id) {
  if (id === 1) return "Exercise";
  if (id === 2) return "Past Papers";
  if (id === 3) return "Additional";
  return String(id);
}

await login();

const hierarchyPath = path.join(RAW_DIR, "hierarchy.json");
const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, "utf8"));
const TOPIC_IDS = (hierarchy.topics || []).map((t) => t.TopicID).join(",");
if (!TOPIC_IDS) throw new Error("No topic IDs in hierarchy");

async function fetchType(subTypeId) {
  const byId = new Map();
  for (const p of PRIORITIES) {
    const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
    u.searchParams.set("TopicIDs", TOPIC_IDS);
    u.searchParams.set("QuestionSubTypeID", String(subTypeId));
    u.searchParams.set("QuestionPeriorityID", String(p));
    u.searchParams.set("SyllabusType", "0");
    const res = await req(u.toString());
    if (!res.ok) {
      console.warn("fetch fail", subTypeId, p, res.status);
      continue;
    }
    const json = JSON.parse(await res.text());
    for (const q of json.QuestionsList || []) byId.set(q.QuestionID, q);
  }
  return [...byId.values()];
}

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

const klass =
  (await GenClass.findOne({ name: /^12TH$/i })) ||
  (await GenClass.findOne({ name: /INTER-?II/i })) ||
  (await GenClass.findOne({ ptsClassId: 12 }));
if (!klass) throw new Error("Class 12 not found");

const subject = await GenSubject.findOne({
  class: klass._id,
  $or: [
    { ptsSubjectId: SUBJECT_ID },
    { slug: "islamiyat-elective" },
    { name: /اسلامیات اختیاری/ },
  ],
});
if (!subject) throw new Error("اسلامیات اختیاری 12 subject not found");

const chapters = await GenChapter.find({ subject: subject._id }).lean();
const topics = await GenTopic.find({
  chapter: { $in: chapters.map((c) => c._id) },
}).lean();

const ptsChapters = hierarchy.chapters || [];
const ptsTopics = hierarchy.topics || [];
const chapOrderByPtsId = new Map();
ptsChapters.forEach((ch, i) => chapOrderByPtsId.set(ch.ChapterID, i + 1));

const topicByPtsId = new Map();
for (const pt of ptsTopics) {
  const order = chapOrderByPtsId.get(pt.ChapterID);
  const chapter = chapters.find((c) => c.order === order);
  if (!chapter) continue;
  const want = normalizeName(pt.TopicName);
  const candidates = topics.filter(
    (t) => String(t.chapter) === String(chapter._id)
  );
  let match =
    candidates.find((t) => normalizeName(t.name) === want) ||
    candidates.find((t) => normalizeName(t.name).includes(want)) ||
    candidates.find((t) => want.includes(normalizeName(t.name))) ||
    null;
  if (!match && pt.TopicRef) {
    const ref = String(pt.TopicRef).replace(/^E\.X:\s*/i, "");
    match =
      candidates.find((t) => String(t.code) === `${order}.${ref}`) ||
      candidates.find((t) => String(t.code)?.endsWith(`.${ref}`)) ||
      null;
  }
  if (!match && candidates.length === 1) match = candidates[0];
  if (match) topicByPtsId.set(pt.TopicID, match);
}
console.log("topic map", topicByPtsId.size, "/", ptsTopics.length);

function resolveTopic(raw) {
  if (topicByPtsId.has(raw.TopicID)) return topicByPtsId.get(raw.TopicID);
  return topics[0] || null;
}

const chapOrderByMongoId = new Map(
  chapters.map((c) => [String(c._id), c.order])
);
const topicCodeById = new Map(topics.map((t) => [String(t._id), t.code]));

hierarchy.exportTypes = [
  { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
  { id: 12, name: "short", bankType: "short", field: "QA" },
  { id: 13, name: "long", bankType: "long", field: "LONG" },
  { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
];
fs.writeFileSync(hierarchyPath, JSON.stringify(hierarchy, null, 2), "utf8");

const list = await fetchType(TYPE_DEF.id);
console.log("live LONG", list.length);

fs.writeFileSync(
  path.join(RAW_DIR, TYPE_DEF.file),
  JSON.stringify(
    {
      field: TYPE_DEF.field,
      type: TYPE_DEF.bankType,
      subTypeId: TYPE_DEF.id,
      name: TYPE_DEF.name,
      questions: list,
    },
    null,
    2
  ),
  "utf8"
);

await GenQuestion.deleteMany({
  subject: subject._id,
  subType: TYPE_DEF.field,
});

const docs = [];
const dumpQs = [];
let skipped = 0;
for (const raw of list) {
  const topic = resolveTopic(raw);
  const en = preservePtsHtml(raw.EnglishQuestionDetails);
  const ur = preservePtsHtml(raw.UrduQuestionDetails);
  const text = (en || ur || "").trim();
  if (!topic || !text) {
    skipped += 1;
    continue;
  }
  docs.push({
    type: "LONG",
    subType: TYPE_DEF.field,
    text,
    textUrdu: ur && ur !== en ? ur : null,
    marks: 5,
    source: TYPE_DEF.field,
    topic: topic._id,
    chapter: topic.chapter,
    subject: subject._id,
    isActive: true,
    externalKey: `${KEY_PREFIX}${TYPE_DEF.id}:${raw.QuestionID}`,
    optionA: null,
    optionB: null,
    optionC: null,
    optionD: null,
    correctAnswer: null,
  });

  const chapterOrder = chapOrderByMongoId.get(String(topic.chapter)) || 0;
  dumpQs.push({
    id: raw.QuestionID,
    chapter: chapterOrder,
    topic_id: topicCodeById.get(String(topic._id)) || String(raw.TopicID),
    type: TYPE_DEF.bankType,
    field: TYPE_DEF.field,
    source: "Long Questions",
    priority: priorityLabel(raw.QuestionPeriorityID || raw.PriorityID || 1),
    en: en || ur,
    ur: ur || en,
  });
}

for (let i = 0; i < docs.length; i += 250) {
  await GenQuestion.insertMany(docs.slice(i, i + 250), { ordered: false });
}
const longMongo = await GenQuestion.countDocuments({
  subject: subject._id,
  subType: TYPE_DEF.field,
  isActive: { $ne: false },
});
console.log("mongo LONG", longMongo, "skipped", skipped);

const allBundle = JSON.parse(fs.readFileSync(ALL_Q, "utf8"));
const keptQuestions = (allBundle.questions || []).filter(
  (q) => String(q.field || "").toUpperCase() !== "LONG"
);
keptQuestions.push(...dumpQs);

const agg = await GenQuestion.aggregate([
  { $match: { subject: subject._id, isActive: { $ne: false } } },
  { $group: { _id: "$subType", n: { $sum: 1 } } },
]);
const fieldCounts = Object.fromEntries(agg.map((r) => [r._id, r.n]));
const total = Object.values(fieldCounts).reduce((a, b) => a + b, 0);

allBundle.total_questions = total;
allBundle.fieldCounts = fieldCounts;
allBundle.counts = {
  mcq: fieldCounts.MCQ || 0,
  short: fieldCounts.QA || 0,
  long:
    (fieldCounts.LONG || 0) +
    (fieldCounts.AYAT || 0) +
    (fieldCounts.HADITH || 0),
};
allBundle.questions = keptQuestions;
allBundle.source =
  "PTS PTB INTER-II (Class 12) اسلامیات اختیاری (read-only export + LONG sync)";
allBundle.exportedAt = new Date().toISOString();
fs.writeFileSync(ALL_Q, JSON.stringify(allBundle, null, 2), "utf8");

const longBundle = {
  board: allBundle.board || "Lahore",
  class: allBundle.class || "12",
  subject: allBundle.subject || "اسلامیات اختیاری",
  slug: "islamiyat-elective",
  source: allBundle.source,
  total_questions: dumpQs.length,
  counts: { long: dumpQs.length },
  fieldCounts: { LONG: fieldCounts.LONG || 0 },
  questions: dumpQs,
  type: "long",
  exportedAt: allBundle.exportedAt,
};
fs.writeFileSync(LONG_Q, JSON.stringify(longBundle, null, 2), "utf8");

fs.mkdirSync(LIVE_DIR, { recursive: true });
fs.writeFileSync(
  path.join(LIVE_DIR, "all-questions.json"),
  JSON.stringify(allBundle, null, 2),
  "utf8"
);
fs.copyFileSync(hierarchyPath, path.join(LIVE_DIR, "hierarchy.json"));
fs.mkdirSync(path.join(LIVE_DIR, "pts-raw"), { recursive: true });
fs.copyFileSync(
  path.join(RAW_DIR, TYPE_DEF.file),
  path.join(LIVE_DIR, "pts-raw", TYPE_DEF.file)
);

console.log("=== FINAL Mongo types ===");
for (const [k, v] of Object.entries(fieldCounts).sort()) {
  console.log(k, v);
}
console.log("TOTAL", total, "expected live LONG 112 → mongo", longMongo);
await mongoose.disconnect();
console.log("DONE");
