import "dotenv/config";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection;
const klass = await db.collection("genclasses").findOne({ name: "9TH" });
const urdu = await db
  .collection("gensubjects")
  .findOne({ class: klass._id, name: /اردو|اُردو/ });

const bySub = await db
  .collection("genquestions")
  .aggregate([
    { $match: { subject: urdu._id } },
    {
      $group: {
        _id: { type: "$type", subType: "$subType" },
        n: { $sum: 1 },
      },
    },
    { $sort: { "_id.type": 1, "_id.subType": 1 } },
  ])
  .toArray();
console.log("mongo subject-wide", bySub);

const chaps = await db
  .collection("genchapters")
  .find({ subject: urdu._id })
  .sort({ order: 1 })
  .toArray();
for (const ch of chaps) {
  const tops = await db
    .collection("gentopics")
    .find({ chapter: ch._id })
    .project({ _id: 1 })
    .toArray();
  const rows = await db
    .collection("genquestions")
    .aggregate([
      { $match: { topic: { $in: tops.map((t) => t._id) } } },
      { $group: { _id: "$subType", n: { $sum: 1 } } },
    ])
    .toArray();
  if (rows.length > 4 || /اردو \(ب\)|اُردو \(ب\)/.test(ch.name)) {
    console.log(
      `Ch${ch.order}`,
      ch.name.slice(0, 36),
      rows.map((r) => `${r._id}=${r.n}`).join(", ")
    );
  }
}
await mongoose.disconnect();
