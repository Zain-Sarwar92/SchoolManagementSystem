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
const chs = await GenChapter.find({ subject: sub._id }).sort({ order: 1 }).lean();
console.log("Subject:", sub.name);
console.log("Chapters:", chs.length);
let totalQ = 0;
for (const c of chs) {
  const ts = await GenTopic.find({ chapter: c._id }).sort({ order: 1 }).lean();
  const qCount = await GenQuestion.countDocuments({ chapter: c._id });
  totalQ += qCount;
  console.log("");
  console.log(`${c.name} | topics ${ts.length} | questions ${qCount}`);
  for (const t of ts) {
    const tq = await GenQuestion.countDocuments({ topic: t._id });
    const mcq = await GenQuestion.countDocuments({ topic: t._id, type: "MCQ" });
    console.log(`   ${t.code || "-"}  ${t.name} | Q ${tq} (MCQ ${mcq})`);
  }
}
const mcq = await GenQuestion.countDocuments({ subject: sub._id, type: "MCQ" });
const short = await GenQuestion.countDocuments({
  subject: sub._id,
  type: "SHORT",
});
const long = await GenQuestion.countDocuments({ subject: sub._id, type: "LONG" });
console.log("");
console.log(`Totals: all ${totalQ} | MCQ ${mcq} | SHORT ${short} | LONG ${long}`);
await mongoose.disconnect();
