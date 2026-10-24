/**
 * Sync Class 9 اسلامیات اختیاری missing PTS types: LONG (13) + HADITH (18).
 *   node src/scripts/syncIslamiyatElective9MissingTypes.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(
  __dirname,
  "../../data/lahore-board/9th/islamiyat-elective/pts-raw"
);
const ALL_Q = path.resolve(
  __dirname,
  "../../data/lahore-board/9th/islamiyat-elective/all-questions.json"
);
const LONG_Q = path.resolve(
  __dirname,
  "../../data/lahore-board/9th/islamiyat-elective/long-questions.json"
);
const BASE = "https://www.paktestsolution.com";
const KEY_PREFIX = "pts:9:56:";
/** PTS Islamiyat elective Long uses pri 1+2+3 (not only Exercise/Additional/Grammar). */
const PRIORITIES = [1, 2, 3, 7];
const TYPES = [
  { id: 13, field: "LONG", bankType: "long", name: "long", file: "long-raw.json" },
  {
    id: 18,
    field: "HADITH",
    bankType: "long",
    name: "long-hadith",
    file: "long-hadith-raw.json",
  },
];

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
  if (jar.size) headers.Cookie = cookieHeader();
  const res = await fetch(url, { headers, redirect: "manual" });
  storeCookies(res);
  return res;
}
async function login() {
  const USER = process.env.PTS_USER?.trim();
  const PASS = process.env.PTS_PASS?.trim();
  if (!USER || !PASS) throw new Error("Set PTS_USER+PTS_PASS");
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u.toString())).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
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
function mapType(bankType) {
  if (bankType === "long") return "LONG";
  if (bankType === "mcq") return "MCQ";
  return "SHORT";
}
function marks(type) {
  if (type === "MCQ") return 1;
  if (type === "LONG") return 5;
  return 2;
}
function normalizeName(s) {
  return String(s || "")
    .replace(/^\d+(\.\d+)?\s*/, "")
    .replace(/["""«»]/g, "")
    .trim()
    .toLowerCase();
}
function strip(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function priorityLabel(id) {
  if (id === 1) return "Exercise";
  if (id === 3) return "Additional";
  if (id === 7) return "Grammar";
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

const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({
  class: klass._id,
  $or: [{ slug: "islamiyat-elective" }, { name: /اسلامیات اختیاری/ }],
});
if (!subject) throw new Error("اسلامیات اختیاری subject not found");

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

const exportTypes = [
  { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
  { id: 12, name: "short", bankType: "short", field: "QA" },
  { id: 13, name: "long", bankType: "long", field: "LONG" },
  { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
  { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
];
hierarchy.exportTypes = exportTypes;
fs.writeFileSync(hierarchyPath, JSON.stringify(hierarchy, null, 2), "utf8");
console.log("hierarchy.exportTypes updated (5 types)");

const allBundle = JSON.parse(fs.readFileSync(ALL_Q, "utf8"));
const keptQuestions = (allBundle.questions || []).filter(
  (q) => q.field !== "LONG" && q.field !== "HADITH"
);
const newLongFileQuestions = (allBundle.questions || []).filter(
  (q) => q.field === "AYAT"
);

const fieldCountsLive = {};

for (const typeDef of TYPES) {
  const list = await fetchType(typeDef.id);
  console.log("live", typeDef.field, list.length);

  fs.writeFileSync(
    path.join(RAW_DIR, typeDef.file),
    JSON.stringify(
      {
        field: typeDef.field,
        type: typeDef.bankType,
        subTypeId: typeDef.id,
        name: typeDef.name,
        questions: list,
      },
      null,
      2
    ),
    "utf8"
  );

  await GenQuestion.deleteMany({
    subject: subject._id,
    subType: typeDef.field,
  });

  const type = mapType(typeDef.bankType);
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
      type,
      subType: typeDef.field,
      text,
      textUrdu: ur && ur !== en ? ur : null,
      marks: marks(type),
      source: typeDef.field,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey: `${KEY_PREFIX}${typeDef.id}:${raw.QuestionID}`,
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
      type: typeDef.bankType,
      field: typeDef.field,
      source:
        typeDef.field === "HADITH" ? "Hadith" : "Long Questions",
      priority: priorityLabel(raw.QuestionPeriorityID || raw.PriorityID || 1),
      en: en || ur,
      ur: ur || en,
    });
  }

  for (let i = 0; i < docs.length; i += 250) {
    await GenQuestion.insertMany(docs.slice(i, i + 250), { ordered: false });
  }
  const n = await GenQuestion.countDocuments({
    subject: subject._id,
    subType: typeDef.field,
    isActive: { $ne: false },
  });
  fieldCountsLive[typeDef.field] = n;
  console.log("mongo", typeDef.field, n, "skipped", skipped);

  keptQuestions.push(...dumpQs);
  if (typeDef.field === "LONG" || typeDef.field === "HADITH") {
    newLongFileQuestions.push(...dumpQs);
  }
}

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
  "PTS PTB Class 9 اسلامیات اختیاری (read-only export + LONG/HADITH sync)";
fs.writeFileSync(ALL_Q, JSON.stringify(allBundle, null, 2), "utf8");

const longBundle = {
  board: allBundle.board || "Lahore",
  class: allBundle.class || "9",
  subject: allBundle.subject || "اسلامیات اختیاری",
  slug: "islamiyat-elective",
  source: allBundle.source,
  total_questions: newLongFileQuestions.length,
  counts: {
    long: newLongFileQuestions.length,
  },
  fieldCounts: {
    AYAT: fieldCounts.AYAT || 0,
    LONG: fieldCounts.LONG || 0,
    HADITH: fieldCounts.HADITH || 0,
  },
  questions: newLongFileQuestions,
};
fs.writeFileSync(LONG_Q, JSON.stringify(longBundle, null, 2), "utf8");

console.log("=== FINAL Mongo types ===");
for (const [k, v] of Object.entries(fieldCounts).sort()) {
  console.log(k, v);
}
console.log("TOTAL", total);
await mongoose.disconnect();
console.log("DONE");
