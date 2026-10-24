/**
 * Receive live PTS Class 10 English dump and replace mismatched subtypes in Mongo.
 *   node src/scripts/syncEnglish10LiveDiff.js
 * Browser POSTs JSON to http://127.0.0.1:8795/ingest
 */
import "dotenv/config";
import http from "http";
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
const PORT = 8795;
const OUT = path.resolve(
  __dirname,
  "../../data/lahore-board/10th/english/_live-diff-sync.json"
);
const DRIVER = path.resolve(__dirname, "./syncEnglish10LiveDiff.browser.js");
const REPLACE_FIELDS = new Set(["VERB", "DI", "ESSAYS", "PAIR"]);

function mapType(type) {
  if (type === "long") return "LONG";
  if (type === "mcq") return "MCQ";
  return "SHORT";
}

function defaultMarks(type) {
  if (type === "LONG") return 5;
  if (type === "MCQ") return 1;
  return 2;
}

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(?!\/?img\b)[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function optionText(opt = {}) {
  return stripHtml(opt.EmOption || opt.UmOption || "") || "—";
}

function correctLetter(opts = []) {
  const sorted = opts.slice().sort((a, b) => a.OptionID - b.OptionID);
  const idx = sorted.findIndex((o) => o.Answer);
  return idx >= 0 ? "ABCD"[idx] : "A";
}

function resolveQuestionText(q) {
  const text = q.en?.trim();
  if (text && text !== ".") return text;
  if (q.field === "SPELLING") return "Tick the correct spelling.";
  if (q.type === "mcq") return q.source?.trim() || "Select the correct option.";
  return q.ur?.trim() || "";
}

function normalizeMcqOptions(q) {
  const raw = [q.optionA, q.optionB, q.optionC, q.optionD];
  if (!raw.some((v) => String(v || "").trim()) && !q.correctAnswer) return null;
  return {
    optionA: raw[0]?.trim() || "—",
    optionB: raw[1]?.trim() || "—",
    optionC: raw[2]?.trim() || "—",
    optionD: raw[3]?.trim() || "—",
    correctAnswer: q.correctAnswer ? String(q.correctAnswer).toUpperCase() : "A",
  };
}

function topicCodeFromRef(ref, name, chapterNum, ti) {
  const r = String(ref || "").trim();
  if (/^\d+$/.test(r)) return `${chapterNum}.${r}`;
  if (/^\d+\.\d+$/.test(r)) return r;
  return `${chapterNum}.${ti + 1}`;
}

function chapterNumber(name, i) {
  const m = String(name || "").match(/UNIT\s*(\d+)|REVIEW\s*(\d+)|(\d+)/i);
  if (m) return Number(m[1] || m[2] || m[3]);
  if (/ENGLISH B/i.test(name || "")) return 15;
  if (/FORMS OF VERBS|TENSES/i.test(name || "")) return 13;
  if (/DIRECT/i.test(name || "")) return 14;
  return i + 1;
}

async function ensureTopicMap(subject) {
  const chapters = await GenChapter.find({ subject: subject._id }).lean();
  const topics = await GenTopic.find({
    chapter: { $in: chapters.map((c) => c._id) },
  }).lean();
  const byCode = new Map();
  const byName = new Map();
  for (const t of topics) {
    if (t.code) byCode.set(String(t.code), t);
    const key = String(t.name || "")
      .replace(/^\d+\.\d+\s*/, "")
      .trim()
      .toLowerCase();
    if (key) byName.set(key, t);
  }
  return { chapters, byCode, byName, subject };
}

async function ensureChapterTopic(subject, chapterNum, chapterTitle, topicCode, topicTitle) {
  let chapter = await GenChapter.findOne({
    subject: subject._id,
    order: chapterNum,
  });
  if (!chapter) {
    chapter = await GenChapter.create({
      subject: subject._id,
      name: `${chapterNum}. ${chapterTitle}`,
      order: chapterNum,
    });
  }
  let topic = await GenTopic.findOne({ chapter: chapter._id, code: topicCode });
  if (!topic) {
    topic = await GenTopic.findOne({
      chapter: chapter._id,
      name: new RegExp(topicTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    });
  }
  if (!topic) {
    const part = String(topicCode).split(".")[1];
    const order = Number(part) || 0;
    topic = await GenTopic.create({
      chapter: chapter._id,
      name: `${topicCode} ${topicTitle}`,
      order,
      code: topicCode,
    });
  } else if (topic.code !== topicCode) {
    topic.code = topicCode;
    await topic.save();
  }
  return topic;
}

async function syncPayload(payload) {
  const { questions, typeTotals } = payload;
  await mongoose.connect(process.env.MONGO_URI);
  const board = await GenBoard.findOne({ name: /PTB|Punjab/i });
  const klass = await GenClass.findOne({ board: board._id, name: /10/i });
  const subject = await GenSubject.findOne({
    class: klass._id,
    name: /^english$/i,
  });
  if (!subject) throw new Error("Class 10 English not found");

  const del = await GenQuestion.deleteMany({
    subject: subject._id,
    subType: { $in: [...REPLACE_FIELDS] },
  });
  console.log(`Deleted old ${[...REPLACE_FIELDS].join(",")}: ${del.deletedCount}`);

  const toCreate = [];
  let skipped = 0;
  for (const q of questions) {
    if (!REPLACE_FIELDS.has(String(q.field || "").toUpperCase())) continue;
    const topic = await ensureChapterTopic(
      subject,
      q.chapter,
      q.chapterTitle || `Chapter ${q.chapter}`,
      q.topic_id,
      q.topicTitle || q.topic_id
    );
    const text = resolveQuestionText(q);
    if (!topic || !text) {
      skipped += 1;
      continue;
    }
    const type = mapType(q.type);
    const subType = String(q.field).toUpperCase();
    let mcqOptions = null;
    if (type === "MCQ") {
      mcqOptions = normalizeMcqOptions(q);
      if (!mcqOptions) {
        skipped += 1;
        continue;
      }
    }
    toCreate.push({
      type,
      subType,
      text,
      textUrdu: q.ur?.trim() || null,
      optionA: mcqOptions?.optionA ?? null,
      optionB: mcqOptions?.optionB ?? null,
      optionC: mcqOptions?.optionC ?? null,
      optionD: mcqOptions?.optionD ?? null,
      correctAnswer: mcqOptions?.correctAnswer ?? q.correctAnswer ?? null,
      marks: defaultMarks(type),
      source: q.source ?? q.priority ?? null,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey: `pts-live:10:english:${subType.toLowerCase()}:${q.id}`,
    });
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 400) {
    const chunk = toCreate.slice(i, i + 400);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
      else if (err?.code === 11000) created += err.result?.nInserted || 0;
      else throw err;
    }
  }

  const rows = await GenQuestion.aggregate([
    { $match: { subject: subject._id } },
    { $group: { _id: "$subType", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  console.log("Mongo counts after sync:", counts);
  console.log({ created, skipped, ptsTypeTotals: typeTotals });
  await mongoose.disconnect();
  return { created, skipped, counts, typeTotals };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "GET" && req.url === "/driver.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(fs.readFileSync(DRIVER, "utf8"));
    return;
  }
  if (req.method === "POST" && req.url === "/ingest") {
    try {
      const body = await readBody(req);
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(body, null, 2));
      const result = await syncPayload(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...result }));
      setTimeout(() => process.exit(0), 300);
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`English10 live-diff ingest on http://127.0.0.1:${PORT}/ingest`);
});
