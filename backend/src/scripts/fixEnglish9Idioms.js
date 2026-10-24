/**
 * Replace Class 9 English IDIOM with PTS short-idioms-raw (124).
 * Topic 10783 ("5 Idioms") is under English B — create 12.5 if missing.
 *   node src/scripts/fixEnglish9Idioms.js
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
const RAW = path.resolve(
  __dirname,
  "../../data/lahore-board/9th/english/pts-raw/short-idioms-raw.json"
);
const KEY_PREFIX = "punjab-textbook:9:english:";

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

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const klass = await GenClass.findOne({ name: /9TH|9/i });
const subject = await GenSubject.findOne({ class: klass._id, slug: "english" });

const del = await GenQuestion.deleteMany({
  subject: subject._id,
  subType: "IDIOM",
});
console.log("deleted IDIOM", del.deletedCount);

let chapter = await GenChapter.findOne({
  subject: subject._id,
  $or: [{ order: 12 }, { name: /english b/i }],
});
if (!chapter) {
  chapter = await GenChapter.create({
    subject: subject._id,
    name: "12. English B",
    order: 12,
  });
}

let topic = await GenTopic.findOne({
  chapter: chapter._id,
  $or: [{ code: "12.5" }, { name: /idiom/i }],
});
if (!topic) {
  topic = await GenTopic.create({
    chapter: chapter._id,
    name: "12.5 Idioms",
    code: "12.5",
    order: 5,
  });
} else {
  topic.code = "12.5";
  topic.name = "12.5 Idioms";
  topic.order = 5;
  await topic.save();
}
console.log("topic", topic.name, String(topic._id));

const data = JSON.parse(fs.readFileSync(RAW, "utf8"));
const docs = [];
for (const raw of data.questions || []) {
  const text = preservePtsHtml(raw.EnglishQuestionDetails);
  if (!text) continue;
  docs.push({
    type: "SHORT",
    subType: "IDIOM",
    text,
    textUrdu: null,
    marks: 2,
    source: "Idioms",
    topic: topic._id,
    chapter: chapter._id,
    subject: subject._id,
    isActive: true,
    externalKey: `${KEY_PREFIX}idiom:${raw.QuestionID}`,
  });
}

await GenQuestion.insertMany(docs, { ordered: false });
const n = await GenQuestion.countDocuments({
  subject: subject._id,
  subType: "IDIOM",
});
console.log("inserted", docs.length, "mongo IDIOM", n);
await mongoose.disconnect();
