import "dotenv/config";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenQuestion from "../models/generator/GenQuestion.js";

const needles = [
  "modern technology, such as precision agriculture",
  "government play in promoting sustainable",
  "water-scarce region",
  "modern technology improve the efficiency of crop rotation",
  "environmental impacts of excessive fertilizer",
  "drones and sensors",
  "water and land-related challenges",
  "Compare and contrast irrigated",
  "major constraints faced",
];

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const board = await GenBoard.findOne({ code: "PTB" });
const klass = await GenClass.findOne({ board: board._id, ptsClassId: 9 });
const sub = await GenSubject.findOne({
  class: klass._id,
  slug: "agriculture-sciences-tech",
});
for (const n of needles) {
  const q = await GenQuestion.findOne({
    subject: sub._id,
    text: { $regex: n.slice(0, 35), $options: "i" },
  }).lean();
  console.log(q ? `FOUND [${q.type}]` : "MISSING   ", n.slice(0, 55));
}
await mongoose.disconnect();
