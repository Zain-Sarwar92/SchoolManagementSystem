/**
 * Local ingest server for live Class 9 PTS seed driven from Cursor browser.
 * Browser page (already logged into PTS) fetches GetQuestions and POSTs here.
 * Does NOT read PTS cookies — only receives question payloads.
 *
 * Usage:
 *   node src/scripts/seedPtsLiveClass9Ingest.js
 * Then drive browser with the companion CDP loop (agent) or:
 *   node src/scripts/seedPtsLiveClass9.js  (if PTS_USER/PTS_PASS set)
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
const DATA_ROOT = path.resolve(__dirname, "../../data/lahore-board/9th");
const PORT = Number(process.env.PTS_INGEST_PORT || 8787);
const BOARD_NAME = "PTB";
const CLASS_NAME = "9TH";
const MONGO_CHUNK = 400;

const summary = [];

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

function topicOrder(topicId) {
  const part = String(topicId).split(".")[1];
  if (part === "R") return 99;
  const n = Number(part);
  return Number.isFinite(n) ? n : 0;
}

function resolveQuestionText(q) {
  const text = q.en?.trim();
  if (text && text !== ".") return text;
  if (q.field === "SPELLING") return "Tick the correct spelling.";
  if (q.type === "mcq") return q.source?.trim() || "Select the correct option.";
  return q.ur?.trim() || "";
}

function normalizeMcqOptions(q) {
  const letters = ["A", "B", "C", "D"];
  const raw = [q.optionA, q.optionB, q.optionC, q.optionD];
  const options = raw.map((value, index) => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    const letter = letters[index];
    if (q.correctAnswer?.toUpperCase() === letter) return "—";
    return null;
  });
  if (!q.correctAnswer || options.some((value) => !value)) return null;
  return {
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    correctAnswer: q.correctAnswer.toUpperCase(),
  };
}

async function upsertSubjectToMongo(syllabus, allQuestions) {
  const slug = syllabus.slug;
  const subjectName = syllabus.subject;
  const keyPrefix = `punjab-textbook:9:${slug}:`;

  let board = await GenBoard.findOne({ name: BOARD_NAME });
  if (!board) {
    board = await GenBoard.create({
      name: BOARD_NAME,
      code: "PTB",
      subtitle: "Syllabus",
      ptsCourseId: 1,
      sortOrder: 1,
    });
  }

  let klass = await GenClass.findOne({ board: board._id, name: CLASS_NAME });
  if (!klass) {
    klass = await GenClass.create({
      board: board._id,
      name: CLASS_NAME,
      ptsClassId: 9,
      gradeLevel: 9,
    });
  }

  let subject = await GenSubject.findOne({ class: klass._id, slug });
  if (!subject) {
    subject = await GenSubject.create({
      class: klass._id,
      name: subjectName,
      slug,
    });
  } else if (subject.name !== subjectName) {
    subject.name = subjectName;
    await subject.save();
  }

  const topicIdByCode = new Map();
  for (const chapterData of syllabus.chapters || []) {
    const chapterName = `${chapterData.number}. ${chapterData.title}`;
    let chapter = await GenChapter.findOne({
      subject: subject._id,
      name: chapterName,
    });
    if (!chapter) {
      chapter = await GenChapter.create({
        subject: subject._id,
        name: chapterName,
        order: chapterData.number,
      });
    } else {
      chapter.order = chapterData.number;
      await chapter.save();
    }

    for (const topicData of chapterData.topics || []) {
      const topicName = `${topicData.id} ${topicData.title}`;
      let topic = await GenTopic.findOne({
        chapter: chapter._id,
        name: topicName,
      });
      if (!topic) {
        topic = await GenTopic.create({
          chapter: chapter._id,
          name: topicName,
          order: topicOrder(topicData.id),
          code: topicData.id,
        });
      } else {
        topic.order = topicOrder(topicData.id);
        topic.code = topicData.id;
        await topic.save();
      }
      topicIdByCode.set(`${chapterData.number}:${topicData.id}`, topic);
      if (!topicIdByCode.has(topicData.id)) {
        topicIdByCode.set(topicData.id, topic);
      }
    }
  }

  const existing = await GenQuestion.find({
    externalKey: {
      $regex: `^${keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    },
  })
    .select("_id externalKey")
    .lean();
  const existingByKey = new Map(
    existing.filter((r) => r.externalKey).map((r) => [r.externalKey, r._id])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
  const toCreate = [];

  for (const q of allQuestions.questions || []) {
    const topic =
      topicIdByCode.get(`${q.chapter}:${q.topic_id}`) ||
      topicIdByCode.get(q.topic_id);
    const text = resolveQuestionText(q);
    if (!topic || !text) {
      skipped += 1;
      continue;
    }

    const type = mapType(q.type);
    const subType = (q.field || type).toUpperCase();
    let mcqOptions = null;
    if (type === "MCQ") {
      mcqOptions = normalizeMcqOptions(q);
      if (!mcqOptions) {
        skipped += 1;
        continue;
      }
    }

    const externalKey = `${keyPrefix}${subType.toLowerCase()}:${q.id}`;
    const payload = {
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
      externalKey,
    };

    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const existingId = existingByKey.get(externalKey);
    if (existingId) {
      await GenQuestion.updateOne({ _id: existingId }, { $set: payload });
      updated += 1;
    } else {
      toCreate.push(payload);
    }
  }

  for (let i = 0; i < toCreate.length; i += MONGO_CHUNK) {
    const chunk = toCreate.slice(i, i + MONGO_CHUNK);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) {
        created += chunk.length - err.writeErrors.length;
      } else if (err?.code === 11000) {
        created += err.result?.nInserted || 0;
      } else {
        throw err;
      }
    }
  }

  return { created, updated, skipped, typeCounts };
}

async function handleSubject(body) {
  const { slug, syllabus, allQuestions, meta } = body;
  if (!slug || !syllabus || !allQuestions) {
    throw new Error("Need slug, syllabus, allQuestions");
  }

  const outDir = path.join(DATA_ROOT, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "syllabus.json"),
    JSON.stringify(syllabus, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "all-questions.json"),
    JSON.stringify(allQuestions, null, 2)
  );

  if (meta?.hierarchy) {
    const rawDir = path.join(outDir, "pts-raw");
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(
      path.join(rawDir, "hierarchy.json"),
      JSON.stringify(meta.hierarchy, null, 2)
    );
  }

  const mongo = await upsertSubjectToMongo(syllabus, allQuestions);
  const row = {
    slug,
    name: syllabus.subject,
    total: allQuestions.total_questions,
    counts: allQuestions.counts,
    fieldCounts: allQuestions.fieldCounts,
    mongo,
    at: new Date().toISOString(),
  };
  summary.push(row);
  fs.writeFileSync(
    path.join(DATA_ROOT, "_live-seed-summary.json"),
    JSON.stringify(summary, null, 2)
  );
  console.log(
    `✓ ${slug}: Q=${row.total} mongo +${mongo.created} ~${mongo.updated} skip ${mongo.skipped}`
  );
  return row;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

await mongoose.connect(process.env.MONGO_URI);
console.log("Mongo connected");

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, subjects: summary.length }));
    return;
  }

  if (req.method === "GET" && req.url === "/driver.js") {
    const driverPath = path.join(__dirname, "ptsLiveClass9BrowserDriver.browser.js");
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(fs.readFileSync(driverPath));
    return;
  }

  if (req.method === "GET" && req.url === "/summary") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(summary, null, 2));
    return;
  }

  if (req.method === "POST" && req.url === "/subject") {
    try {
      const body = await readBody(req);
      const row = await handleSubject(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, row }));
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
  console.log(`PTS Class 9 ingest listening on http://127.0.0.1:${PORT}`);
  console.log("POST /subject  GET /health  GET /summary");
});
