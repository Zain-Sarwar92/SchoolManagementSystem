/**
 * Import Class 9 English ch13 Tenses (VERB / TRANSLATE_EN / VOICE) into Mongo.
 *   node src/scripts/importEnglish9Tenses.js
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
const LB = path.resolve(__dirname, "../../data/lahore-board/9th/english");
const LIVE = path.resolve(
  __dirname,
  "../../data/pts-live/PTB/9/english/all-questions.json"
);
const KEY_PREFIX = "punjab-textbook:9:english:";

function mapType(t) {
  if (t === "long" || t === "LONG") return "LONG";
  if (t === "mcq" || t === "MCQ") return "MCQ";
  return "SHORT";
}

function marks(type) {
  if (type === "MCQ") return 1;
  if (type === "LONG") return 5;
  return 2;
}

function textOf(q) {
  return String(q.en || q.ur || "").trim();
}

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({
  class: klass._id,
  $or: [{ slug: "english" }, { name: /^english$/i }],
});
if (!subject) throw new Error("English subject not found");

const syllabus = JSON.parse(
  fs.readFileSync(path.join(LB, "syllabus.json"), "utf8")
);
const chData = (syllabus.chapters || []).find((c) => c.number === 13);
if (!chData) throw new Error("Tenses chapter missing in syllabus");

let chapter = await GenChapter.findOne({
  subject: subject._id,
  $or: [{ order: 13 }, { name: /tenses/i }],
});
if (!chapter) {
  chapter = await GenChapter.create({
    subject: subject._id,
    name: `13. ${chData.title}`,
    order: 13,
  });
} else {
  chapter.order = 13;
  chapter.name = `13. ${chData.title}`;
  await chapter.save();
}

const topicByCode = new Map();
for (const td of chData.topics || []) {
  let topic = await GenTopic.findOne({
    chapter: chapter._id,
    $or: [{ code: td.id }, { name: new RegExp(`^${td.id}\\b`) }],
  });
  if (!topic) {
    topic = await GenTopic.create({
      chapter: chapter._id,
      name: `${td.id} ${td.title}`,
      order: Number(String(td.id).split(".").pop()) || 0,
      code: td.id,
    });
  } else {
    topic.code = td.id;
    topic.name = `${td.id} ${td.title}`;
    await topic.save();
  }
  topicByCode.set(td.id, topic);
}

const all = JSON.parse(
  fs.readFileSync(path.join(LB, "all-questions.json"), "utf8")
);
const tenseQs = (all.questions || []).filter(
  (q) =>
    Number(q.chapter) === 13 &&
    ["VERB", "TRANSLATE_EN", "VOICE"].includes(String(q.field || "").toUpperCase())
);

const existing = await GenQuestion.find({
  subject: subject._id,
  externalKey: { $regex: `^${KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
})
  .select("_id externalKey")
  .lean();
const byKey = new Map(
  existing.filter((r) => r.externalKey).map((r) => [r.externalKey, r._id])
);

const ops = [];
let created = 0;
let updated = 0;
let skipped = 0;
const fieldCounts = {};

for (const q of tenseQs) {
  const topic = topicByCode.get(q.topic_id);
  const text = textOf(q);
  if (!topic || !text) {
    skipped += 1;
    continue;
  }
  const type = mapType(q.type);
  const subType = String(q.field).toUpperCase();
  const externalKey = `${KEY_PREFIX}${subType.toLowerCase()}:${q.id}`;
  const payload = {
    type,
    subType,
    text,
    textUrdu: q.ur?.trim() || null,
    marks: marks(type),
    source: q.source ?? q.priority ?? null,
    topic: topic._id,
    chapter: chapter._id,
    subject: subject._id,
    isActive: true,
    externalKey,
    optionA: q.optionA || null,
    optionB: q.optionB || null,
    optionC: q.optionC || null,
    optionD: q.optionD || null,
    correctAnswer: q.correctAnswer || null,
  };
  const id = byKey.get(externalKey);
  if (id) {
    ops.push({ updateOne: { filter: { _id: id }, update: { $set: payload } } });
    updated += 1;
  } else {
    ops.push({ insertOne: { document: payload } });
    created += 1;
  }
  fieldCounts[subType] = (fieldCounts[subType] || 0) + 1;
}

for (let i = 0; i < ops.length; i += 300) {
  await GenQuestion.bulkWrite(ops.slice(i, i + 300), { ordered: false });
}

console.log("Done", { created, updated, skipped, fieldCounts });

if (fs.existsSync(LIVE)) {
  const live = JSON.parse(fs.readFileSync(LIVE, "utf8"));
  const byId = new Map((live.questions || []).map((q) => [String(q.id), q]));
  for (const q of tenseQs) byId.set(String(q.id), q);
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
  live.importedTensesAt = new Date().toISOString();
  fs.writeFileSync(LIVE, JSON.stringify(live, null, 2));
  console.log("pts-live updated", live.total_questions);
}

const agg = await GenQuestion.aggregate([
  { $match: { subject: subject._id } },
  { $group: { _id: { type: "$type", subType: "$subType" }, n: { $sum: 1 } } },
  { $sort: { "_id.type": 1, "_id.subType": 1 } },
]);
console.log(
  "mongo now",
  agg.map((r) => `${r._id.type}/${r._id.subType}=${r.n}`).join(", ")
);

await mongoose.disconnect();
