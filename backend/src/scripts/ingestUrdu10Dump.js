/**
 * Ingest already-fetched Class 10 اُردو لازمی dump into Mongo.
 *   node src/scripts/ingestUrdu10Dump.js
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  "../../data/pts-live/PTB/10/ا-ردو-لازمی"
);
const CLASS_ID = 10;
const SUBJECT_ID = 66;

function typeUpper(t) {
  if (t === "mcq" || t === "MCQ") return "MCQ";
  if (t === "long" || t === "LONG") return "LONG";
  return "SHORT";
}

function marksFor(t) {
  const u = typeUpper(t);
  if (u === "MCQ") return 1;
  if (u === "LONG") return 5;
  return 2;
}

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

const dump = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, "all-questions.json"), "utf8")
);
const syllabus = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, "syllabus.json"), "utf8")
);

const board =
  (await GenBoard.findOne({ code: "PTB" })) ||
  (await GenBoard.findOne({ name: /PTB|Punjab/i }));
const klass =
  (await GenClass.findOne({ board: board._id, ptsClassId: CLASS_ID })) ||
  (await GenClass.findOne({ board: board._id, name: /10TH|10/i }));
const subject = await GenSubject.findOne({
  class: klass._id,
  name: /اُردو\s*لازمی|اردو\s*لازمی/i,
});
if (!subject) throw new Error("subject missing");

console.log("subject", subject.name, String(subject._id));
console.log("dump questions", dump.questions?.length);

const topicIdByCode = new Map();

for (const chapterData of syllabus.chapters || []) {
  const chapterName = `${chapterData.number}. ${chapterData.title}`;
  let chapter = await GenChapter.findOne({
    subject: subject._id,
    name: chapterName,
  });
  if (!chapter) {
    chapter = await GenChapter.findOne({
      subject: subject._id,
      order: chapterData.number,
    });
  }
  if (!chapter) {
    /* fuzzy: name contains title */
    chapter = await GenChapter.findOne({
      subject: subject._id,
      name: new RegExp(
        chapterData.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ),
    });
  }
  if (!chapter) {
    chapter = await GenChapter.create({
      subject: subject._id,
      name: chapterName,
      order: chapterData.number,
    });
    console.log("created chapter", chapterName);
  } else {
    await GenChapter.updateOne(
      { _id: chapter._id },
      { $set: { name: chapterName, order: chapterData.number } }
    );
  }

  for (const topicData of chapterData.topics || []) {
    const topicName = `${topicData.id} ${topicData.title}`;
    let topic = await GenTopic.findOne({
      chapter: chapter._id,
      name: topicName,
    });
    if (!topic) {
      topic = await GenTopic.findOne({
        chapter: chapter._id,
        code: topicData.id,
      });
    }
    if (!topic) {
      topic = await GenTopic.create({
        chapter: chapter._id,
        name: topicName,
        code: topicData.id,
        order: Number(String(topicData.id).split(".").pop()) || 1,
      });
      console.log("created topic", topicName);
    } else {
      await GenTopic.updateOne(
        { _id: topic._id },
        {
          $set: {
            name: topicName,
            code: topicData.id,
          },
        }
      );
    }
    topicIdByCode.set(`${chapterData.number}:${topicData.id}`, topic);
    if (!topicIdByCode.has(topicData.id)) {
      topicIdByCode.set(topicData.id, topic);
    }
  }
}

const existingCount = await GenQuestion.countDocuments({
  subject: subject._id,
});
if (existingCount) {
  const del = await GenQuestion.deleteMany({ subject: subject._id });
  console.log("cleared leftover", del.deletedCount);
}

const keyPrefix = `pts:${CLASS_ID}:${SUBJECT_ID}:`;
const payloads = [];
let skipped = 0;
for (const q of dump.questions || []) {
  const topic =
    topicIdByCode.get(`${q.chapter}:${q.topic_id}`) ||
    topicIdByCode.get(q.topic_id);
  const text = String(q.en || "").trim();
  if (!topic || !text) {
    skipped += 1;
    continue;
  }
  const type = typeUpper(q.type);
  payloads.push({
    type,
    subType: String(q.field || type).toUpperCase(),
    text,
    textUrdu: q.ur?.trim() || null,
    optionA: q.optionA || null,
    optionB: q.optionB || null,
    optionC: q.optionC || null,
    optionD: q.optionD || null,
    correctAnswer: q.correctAnswer || null,
    marks: marksFor(q.type),
    source: q.source || q.field || null,
    topic: topic._id,
    chapter: topic.chapter,
    subject: subject._id,
    isActive: true,
    externalKey: `${keyPrefix}${q.subTypeId}:${q.id}`,
  });
}

console.log("to insert", payloads.length, "skipped", skipped);

let created = 0;
const CHUNK = 400;
for (let i = 0; i < payloads.length; i += CHUNK) {
  const chunk = payloads.slice(i, i + CHUNK);
  try {
    const res = await GenQuestion.insertMany(chunk, { ordered: false });
    created += res.length;
  } catch (err) {
    if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
    else if (err?.code === 11000) created += err.result?.nInserted || 0;
    else throw err;
  }
}

const bySub = await GenQuestion.aggregate([
  { $match: { subject: subject._id, isActive: true } },
  {
    $group: {
      _id: { type: "$type", subType: "$subType" },
      count: { $sum: 1 },
    },
  },
  { $sort: { "_id.type": 1, "_id.subType": 1 } },
]);
const total = await GenQuestion.countDocuments({
  subject: subject._id,
  isActive: true,
});

console.log("\n=== SYSTEM ===");
for (const r of bySub) {
  console.log(`${r._id.type}\t${r._id.subType}\t${r.count}`);
}
console.log(`TOTAL\t${total}\tcreated\t${created}`);

fs.writeFileSync(
  path.join(OUT_DIR, "_seed-result.json"),
  JSON.stringify(
    {
      classId: CLASS_ID,
      subjectId: SUBJECT_ID,
      name: "اُردو لازمی",
      total,
      typeTotals: dump.typeTotals,
      mongo: {
        created,
        skipped,
        typeCounts: Object.fromEntries(
          bySub.map((r) => [`${r._id.type}:${r._id.subType}`, r.count])
        ),
      },
      at: new Date().toISOString(),
    },
    null,
    2
  )
);

await mongoose.disconnect();
