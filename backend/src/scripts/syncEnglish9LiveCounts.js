/**
 * Sync Class 9 English VERB/VOICE/STORY/IDIOM from live PTS All-Topics counts.
 *   node src/scripts/syncEnglish9LiveCounts.js
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
  "../../data/lahore-board/9th/english/pts-raw"
);
const BASE = "https://www.paktestsolution.com";
const KEY_PREFIX = "punjab-textbook:9:english:";
const TOPIC_IDS =
  "10703,10704,10705,10706,10707,10708,10709,10710,10711,10712,10713,10779,10780,10781,10782,11177,11178,11179,11180,11181,11182,11183,11184,11185,11186,11187,11188,11189,11190,11191";
const PRIORITIES = [1, 3, 4, 7];
const TYPES = [
  { id: 5, field: "VERB", bankType: "mcq", expect: 334 },
  { id: 22, field: "VOICE", bankType: "short", expect: 326 },
  { id: 26, field: "STORY", bankType: "long", expect: 22 },
  { id: 36, field: "IDIOM", bankType: "short", expect: 292 },
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

await login();
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({ class: klass._id, slug: "english" });
const chapters = await GenChapter.find({ subject: subject._id }).lean();
const topics = await GenTopic.find({
  chapter: { $in: chapters.map((c) => c._id) },
}).lean();

const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW_DIR, "hierarchy.json"), "utf8")
);
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

/** Ensure English B / Idioms topic for orphan TopicIDs like 10783 */
let engB = chapters.find((c) => c.order === 12 || /english b/i.test(c.name));
if (!engB) {
  engB = await GenChapter.create({
    subject: subject._id,
    name: "12. English B",
    order: 12,
  });
}
let idiomTopic = await GenTopic.findOne({
  chapter: engB._id,
  $or: [{ code: "12.5" }, { name: /idiom/i }],
});
if (!idiomTopic) {
  idiomTopic = await GenTopic.create({
    chapter: engB._id,
    name: "12.5 Idioms",
    code: "12.5",
    order: 5,
  });
}
topicByPtsId.set(10783, idiomTopic);

/** Tenses topics 11177+ — ensure chapter 13 topics exist mapped by order */
const tenseChapter = chapters.find(
  (c) => c.order === 13 || /tense/i.test(c.name)
);
const tenseTopics = tenseChapter
  ? topics.filter((t) => String(t.chapter) === String(tenseChapter._id))
  : [];

function resolveTopic(raw) {
  if (topicByPtsId.has(raw.TopicID)) return topicByPtsId.get(raw.TopicID);
  // Tenses TopicIDs often sequential from 11177
  if (raw.TopicID >= 11177 && tenseTopics.length) {
    const idx = raw.TopicID - 11177;
    if (tenseTopics[idx]) return tenseTopics[idx];
    return tenseTopics[0];
  }
  // English B orphans
  if (raw.TopicID >= 10779 && raw.TopicID <= 10790) return idiomTopic;
  return topics[0] || idiomTopic;
}

console.log("topic map", topicByPtsId.size);

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
      externalKey: `${KEY_PREFIX}${typeDef.field.toLowerCase()}:${raw.QuestionID}`,
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

await mongoose.disconnect();
console.log("DONE");
