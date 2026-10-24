/**
 * Import Class 9 اُردو لازمی missing PTS subtypes from lahore-board pts-raw.
 *   node src/scripts/importUrdu9MissingTypes.js
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
  "../../data/lahore-board/9th/urdu-compulsory/pts-raw"
);
const LIVE_Q = path.resolve(
  __dirname,
  "../../data/pts-live/PTB/9/ا-ردو-لازمی/all-questions.json"
);

const KEEP = new Set([
  "img", "br", "sub", "sup", "span", "strong", "em", "b", "i", "u",
]);

const FILES = [
  "long-letter-raw.json",
  "long-application-raw.json",
  "long-story-raw.json",
  "long-dialogue-raw.json",
  "short-correct-raw.json",
  "short-idiom-raw.json",
  "short-meaning-raw.json",
];

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

function marksFor(bankType) {
  if (bankType === "mcq") return 1;
  if (bankType === "long") return 5;
  return 2;
}

function mapType(bankType) {
  if (bankType === "long") return "LONG";
  if (bankType === "mcq") return "MCQ";
  return "SHORT";
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
    .trim();
}

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({
  class: klass._id,
  name: /اردو|اُردو|urdu/i,
});
if (!subject) throw new Error("Urdu subject not found");

const chapters = await GenChapter.find({ subject: subject._id }).lean();
const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
const topics = await GenTopic.find({
  chapter: { $in: chapters.map((c) => c._id) },
}).lean();

const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW_DIR, "hierarchy.json"), "utf8")
);
const ptsChapters = hierarchy.chapters || hierarchy.ChaptersList || [];
const ptsTopics = hierarchy.topics || hierarchy.TopicsList || [];
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
console.log(`Topic map: ${topicByPtsId.size}/${ptsTopics.length}`);

const existing = await GenQuestion.find({ subject: subject._id })
  .select("_id externalKey")
  .lean();
const byKey = new Map();
const byQid = new Map();
for (const row of existing) {
  if (!row.externalKey) continue;
  byKey.set(row.externalKey, row._id);
  const m = String(row.externalKey).match(/:(\d+)$/);
  if (m && !byQid.has(m[1])) byQid.set(m[1], row._id);
}

let created = 0;
let updated = 0;
let skipped = 0;
const fieldCounts = {};
const liveExtras = [];
const ops = [];

for (const file of FILES) {
  const data = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf8"));
  const field = String(data.field || "").toUpperCase();
  const bankType =
    data.type || data.questions?.[0]?._exportMeta?.bankType || "short";
  const subTypeId =
    data.subTypeId || data.questions?.[0]?._exportMeta?.subTypeId;
  const list = data.questions || [];
  console.log(`${file} field=${field} n=${list.length}`);

  for (const raw of list) {
    const topic = topicByPtsId.get(raw.TopicID);
    if (!topic) {
      skipped += 1;
      continue;
    }
    const chapter = chapterById.get(String(topic.chapter));
    const en = preservePtsHtml(raw.EnglishQuestionDetails);
    const ur = preservePtsHtml(raw.UrduQuestionDetails);
    const text = (en || ur || "").trim();
    if (!text) {
      skipped += 1;
      continue;
    }
    const type = mapType(bankType);
    const externalKey = `pts:9:50:${subTypeId}:${raw.QuestionID}`;
    const payload = {
      type,
      subType: field,
      text,
      textUrdu: ur && ur !== en ? ur : null,
      marks: marksFor(bankType),
      source: field,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey,
      optionA: null,
      optionB: null,
      optionC: null,
      optionD: null,
      correctAnswer: null,
    };
    if (type === "MCQ") {
      const sorted = [...(raw.MultipleOptions || [])].sort(
        (a, b) => a.OptionID - b.OptionID
      );
      payload.optionA = optionText(sorted[0] || {}) || "—";
      payload.optionB = optionText(sorted[1] || {}) || "—";
      payload.optionC = optionText(sorted[2] || {}) || "—";
      payload.optionD = optionText(sorted[3] || {}) || "—";
      payload.correctAnswer = correctLetter(sorted);
    }

    const existingId =
      byKey.get(externalKey) || byQid.get(String(raw.QuestionID));
    if (existingId) {
      ops.push({
        updateOne: { filter: { _id: existingId }, update: { $set: payload } },
      });
      updated += 1;
    } else {
      ops.push({ insertOne: { document: payload } });
      created += 1;
    }
    fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    liveExtras.push({
      id: raw.QuestionID,
      chapter: chapter?.order || 21,
      topic_id: topic.code || `${chapter?.order}.1`,
      type: bankType,
      field,
      subTypeId,
      source: field,
      priority: raw.QuestionPeriority || "Exercise",
      en: text,
      ur: ur && ur !== en ? ur : undefined,
    });
  }
}

for (let i = 0; i < ops.length; i += 200) {
  await GenQuestion.bulkWrite(ops.slice(i, i + 200), { ordered: false });
}

console.log("Done", { created, updated, skipped, fieldCounts });

if (fs.existsSync(LIVE_Q) && liveExtras.length) {
  const live = JSON.parse(fs.readFileSync(LIVE_Q, "utf8"));
  const byId = new Map((live.questions || []).map((q) => [String(q.id), q]));
  for (const q of liveExtras) byId.set(String(q.id), q);
  live.questions = [...byId.values()];
  live.total_questions = live.questions.length;
  const typeTotals = {};
  for (const q of live.questions) {
    typeTotals[q.field] = (typeTotals[q.field] || 0) + 1;
  }
  live.typeTotals = typeTotals;
  live.counts = {
    mcq: live.questions.filter((q) => q.type === "mcq").length,
    short: live.questions.filter((q) => q.type === "short").length,
    long: live.questions.filter((q) => q.type === "long").length,
  };
  live.importedMissingAt = new Date().toISOString();
  fs.writeFileSync(LIVE_Q, JSON.stringify(live, null, 2));
  console.log("Updated pts-live all-questions.json", live.total_questions);
}

const final = await GenQuestion.aggregate([
  { $match: { subject: subject._id } },
  { $group: { _id: { type: "$type", subType: "$subType" }, n: { $sum: 1 } } },
  { $sort: { "_id.type": 1, "_id.subType": 1 } },
]);
console.log("mongo now", final);

await mongoose.disconnect();
