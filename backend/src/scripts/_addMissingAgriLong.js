/**
 * Add any LONG questions from paste that PTS discover missed
 * (usually Conceptuals subtypes).
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";

const MISSING_LONGS = [
  {
    code: "1.8",
    en: "How can modern technology, such as precision agriculture and biotechnology, revolutionize farming practices in Pakistan?",
    ur: "جدید ٹیکنالوجی جیسے کہ پریسیژن ایگریکلچر اور بائیو ٹیکنالوجی پاکستان میں کاشتکاری کے طریقوں کو کس طرح انقلاب کی شکل دے سکتا ہے؟",
    source: "Conceptuals",
  },
  {
    code: "1.10",
    en: "What role can the government play in promoting sustainable agricultural practices, such as agroforestry and organic farming, in Pakistan?",
    ur: "حکومت پاکستان پائیدار زرعی طریقوں جیسے: ایگروفاریسٹری اور نامیاتی زراعت کو فروغ دینے میں کیا کردار ادا کرسکتی ہے؟",
    source: "Conceptuals",
  },
  {
    code: "2.2",
    en: "If you were a farmer in a water-scarce region, which cropping pattern would you choose and why?",
    ur: "اگر آپ پانی کی کمی والے علاقے کے کسان ہوتے تو آپ کون سی فصلوں کا باری بدلنے کا طریقہ اپناتے اور کیوں؟",
    source: "Conceptuals",
  },
  {
    code: "2.6",
    en: "How can modern technology improve the efficiency of crop rotation and intercropping systems?",
    ur: "جدید ٹیکنالوجی فصلوں کی گردش اور فصلات کے درمیان ہونے والی کاشت کے نظام کو کس طرح موثر بنا سکتی ہے؟",
    source: "Conceptuals",
  },
  {
    code: "3.2",
    en: "What are the environmental impacts of excessive fertilizer use in agriculture, and how can they be minimized?",
    ur: "زراعت میں کھادوں کے زیادہ استعمال کے ماحولیاتی اثرات کیا ہیں، اور ان کو کم کرنے کے کیا طریقے ہوسکتے ہیں؟",
    source: "Conceptuals",
  },
  {
    code: "3.4",
    en: "How can modern technology, like drones and sensors, improve crop yields in Pakistan?",
    ur: "جدید ٹیکنالوجی، جیسے ڈرونز اور سینسرز کس طرح پاکستان میں فصلوں کی پیداوار کو بہتر بنا سکتے ہیں؟",
    source: "Conceptuals",
  },
];

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const board = await GenBoard.findOne({ code: "PTB" });
const klass = await GenClass.findOne({ board: board._id, ptsClassId: 9 });
const sub = await GenSubject.findOne({
  class: klass._id,
  slug: "agriculture-sciences-tech",
});

let created = 0;
let skipped = 0;
for (const row of MISSING_LONGS) {
  const topic = await GenTopic.findOne({
    code: row.code,
    chapter: { $in: await GenChapter.find({ subject: sub._id }).distinct("_id") },
  });
  if (!topic) {
    console.warn("No topic for", row.code);
    continue;
  }
  const chapter = await GenChapter.findById(topic.chapter);
  const exists = await GenQuestion.findOne({
    subject: sub._id,
    type: "LONG",
    text: new RegExp(
      row.en.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    ),
  });
  if (exists) {
    console.log("skip exists:", row.code, row.en.slice(0, 50));
    skipped += 1;
    continue;
  }
  const externalKey = `manual:agri-tech:long:${row.code}:${created + skipped + 1}`;
  await GenQuestion.create({
    subject: sub._id,
    chapter: chapter._id,
    topic: topic._id,
    type: "LONG",
    subType: "LONG",
    text: row.en,
    textUrdu: row.ur,
    marks: 5,
    source: row.source,
    externalKey,
    isActive: true,
  });
  console.log("added:", row.code, row.en.slice(0, 60));
  created += 1;
}

const short = await GenQuestion.countDocuments({ subject: sub._id, type: "SHORT" });
const long = await GenQuestion.countDocuments({ subject: sub._id, type: "LONG" });
const mcq = await GenQuestion.countDocuments({ subject: sub._id, type: "MCQ" });
console.log(`\nDone. created=${created} skipped=${skipped}`);
console.log(`Now: MCQ=${mcq} SHORT=${short} LONG=${long}`);
await mongoose.disconnect();
