/**
 * Sync Class 9 اسلامیات لازمی MCQ/QA/LONG counts to live PTS All-Topics.
 *   node --dns-result-order=ipv4first src/scripts/syncIslamiyatCompulsory9Counts.js
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
  "../../data/lahore-board/9th/islamiyat-compulsory/pts-raw"
);
const BASE = "https://www.paktestsolution.com";
const KEY_PREFIX = "pts:9:51:";
const PRIORITIES = [1, 2, 3, 7];
const TYPES = [
  { id: 1, field: "MCQ", bankType: "mcq", expect: 1246 },
  { id: 12, field: "QA", bankType: "short", expect: 1459 },
  { id: 13, field: "LONG", bankType: "long", expect: 182 },
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
function normalizeName(s) {
  return String(s || "")
    .replace(/^\d+(\.\d+)?\s*/, "")
    .replace(/["""«»]/g, "")
    .trim()
    .toLowerCase();
}

await login();
const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW_DIR, "hierarchy.json"), "utf8")
);
const TOPIC_IDS = (hierarchy.topics || []).map((t) => t.TopicID).join(",");
if (!TOPIC_IDS) throw new Error("No topic IDs");

async function fetchType(subTypeId) {
  const byId = new Map();
  for (const p of PRIORITIES) {
    const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
    u.searchParams.set("TopicIDs", TOPIC_IDS);
    u.searchParams.set("QuestionSubTypeID", String(subTypeId));
    u.searchParams.set("QuestionPeriorityID", String(p));
    u.searchParams.set("SyllabusType", "0");
    const res = await req(u.toString());
    if (!res.ok) continue;
    const json = JSON.parse(await res.text());
    for (const q of json.QuestionsList || []) byId.set(q.QuestionID, q);
  }
  return [...byId.values()];
}

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({
  class: klass._id,
  $or: [{ slug: "islamiyat-compulsory" }, { name: /اسلامیات لازمی/ }],
});
if (!subject) throw new Error("اسلامیات لازمی not found");

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

for (const typeDef of TYPES) {
  const list = await fetchType(typeDef.id);
  console.log("live", typeDef.field, list.length, "expect", typeDef.expect);

  await GenQuestion.deleteMany({
    subject: subject._id,
    subType: typeDef.field,
  });

  const type = mapType(typeDef.bankType);
  const docs = [];
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
    const payload = {
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
    };
    if (type === "MCQ") {
      const sorted = [...(raw.MultipleOptions || [])].sort(
        (a, b) => (a.OptionID || 0) - (b.OptionID || 0)
      );
      payload.optionA = optionText(sorted[0] || {}) || "—";
      payload.optionB = optionText(sorted[1] || {}) || "—";
      payload.optionC = optionText(sorted[2] || {}) || "—";
      payload.optionD = optionText(sorted[3] || {}) || "—";
      payload.correctAnswer = correctLetter(sorted);
    }
    docs.push(payload);
  }

  for (let i = 0; i < docs.length; i += 250) {
    await GenQuestion.insertMany(docs.slice(i, i + 250), { ordered: false });
  }
  const n = await GenQuestion.countDocuments({
    subject: subject._id,
    subType: typeDef.field,
    isActive: { $ne: false },
  });
  console.log(
    n === typeDef.expect ? "OK" : "DIFF",
    typeDef.field,
    "mongo",
    n,
    "skipped",
    skipped
  );
}

const agg = await GenQuestion.aggregate([
  { $match: { subject: subject._id, isActive: { $ne: false } } },
  { $group: { _id: "$subType", n: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);
console.log("=== FINAL ===");
agg.forEach((r) => console.log(r._id, r.n));
await mongoose.disconnect();
console.log("DONE");
