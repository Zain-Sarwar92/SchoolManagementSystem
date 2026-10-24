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
const summaryPath = path.resolve(
  __dirname,
  "../../data/lahore-board/9th/_live-seed-summary.json"
);

await mongoose.connect(process.env.MONGO_URI);
const board = await GenBoard.findOne({ name: "PTB" });
const cls = await GenClass.findOne({ board: board._id, name: "9TH" });
const subjects = await GenSubject.find({ class: cls._id }).sort({ name: 1 }).lean();

console.log("Class 9 subjects:", subjects.length);
let totalQ = 0;
const rows = [];
for (const s of subjects) {
  const chapterIds = await GenChapter.find({ subject: s._id }).distinct("_id");
  const ch = chapterIds.length;
  const topics = await GenTopic.countDocuments({ chapter: { $in: chapterIds } });
  const qs = await GenQuestion.aggregate([
    { $match: { subject: s._id, isActive: true } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(qs.map((x) => [x._id, x.n]));
  const n = Object.values(map).reduce((a, b) => a + b, 0);
  totalQ += n;
  rows.push({ slug: s.slug, chapters: ch, topics, questions: n, types: map });
  console.log(
    `${s.slug.padEnd(22)} ch ${String(ch).padStart(3)} topics ${String(topics).padStart(4)} Q ${String(n).padStart(5)}`,
    map
  );
}
console.log("TOTAL Q", totalQ);

if (fs.existsSync(summaryPath)) {
  const live = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  console.log("\nLive seed summary subjects:", live.length);
  let mismatches = 0;
  for (const row of live) {
    const mongo = rows.find((r) => r.slug === row.slug);
    if (!mongo) {
      console.log("MISSING in mongo:", row.slug);
      mismatches++;
      continue;
    }
    if (mongo.questions !== row.total) {
      console.log(
        `COUNT Δ ${row.slug}: live ${row.total} vs mongo ${mongo.questions}`
      );
      mismatches++;
    } else {
      console.log(`OK ${row.slug}: ${row.total}`);
    }
  }
  console.log("Mismatches:", mismatches);
}

await mongoose.disconnect();
