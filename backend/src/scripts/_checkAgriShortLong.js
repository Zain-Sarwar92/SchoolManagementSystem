import "dotenv/config";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const board = await GenBoard.findOne({ code: "PTB" });
const klass = await GenClass.findOne({ board: board._id, ptsClassId: 9 });
const sub = await GenSubject.findOne({
  class: klass._id,
  slug: "agriculture-sciences-tech",
});

const short = await GenQuestion.countDocuments({ subject: sub._id, type: "SHORT" });
const long = await GenQuestion.countDocuments({ subject: sub._id, type: "LONG" });
const mcq = await GenQuestion.countDocuments({ subject: sub._id, type: "MCQ" });
console.log(`Totals MCQ=${mcq} SHORT=${short} LONG=${long}`);

const samples = [
  "Define Agriculture",
  "What is Agronomy",
  "Discuss the importance of agriculture",
  "Explain Crop Production and Livestock",
];
for (const s of samples) {
  const q = await GenQuestion.findOne({
    subject: sub._id,
    text: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  }).lean();
  console.log(
    q
      ? `FOUND [${q.type}] ${String(q.text).slice(0, 80)}`
      : `MISSING: ${s}`
  );
}

const byTopic = await GenQuestion.aggregate([
  { $match: { subject: sub._id, type: { $in: ["SHORT", "LONG"] } } },
  {
    $lookup: {
      from: "gentopics",
      localField: "topic",
      foreignField: "_id",
      as: "t",
    },
  },
  { $unwind: "$t" },
  {
    $group: {
      _id: { code: "$t.code", type: "$type" },
      n: { $sum: 1 },
    },
  },
  { $sort: { "_id.code": 1, "_id.type": 1 } },
]);
console.log("\nSHORT/LONG by topic:");
for (const r of byTopic) {
  console.log(`  ${r._id.code} ${r._id.type}: ${r.n}`);
}

await mongoose.disconnect();
