/**
 * Live PTS → Mongo REPLACE seed for Class 9–12.
 * Wipes subject's chapters/topics/questions then inserts PTS bank exactly.
 *
 *   node src/scripts/seedPtsLiveMatchIngest.js
 * Browser: load /driver.js then window.__ptsMatch.seedQueue(...)
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
import { logoForSubjectSlug } from "../constants/ptsSubjectLogos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, "../../data/pts-live/PTB");
const PORT = Number(process.env.PTS_MATCH_PORT || 8791);
const MONGO_CHUNK = 400;

const CLASS_META = {
  9: { name: "9TH", gradeLevel: 9 },
  10: { name: "10TH", gradeLevel: 10 },
  11: { name: "INTER-I", gradeLevel: 11 },
  12: { name: "INTER-II", gradeLevel: 12 },
};

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
  const present = raw.filter((v) => String(v || "").trim()).length;
  /* Keep PTS MCQs even if options are sparse — still store the question */
  if (present < 1 && !q.correctAnswer) return null;
  const options = raw.map((value, index) => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    return "—";
  });
  return {
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    correctAnswer: q.correctAnswer ? String(q.correctAnswer).toUpperCase() : "A",
  };
}

async function wipeSubject(subjectId) {
  const chapters = await GenChapter.find({ subject: subjectId }).select("_id");
  const chapterIds = chapters.map((c) => c._id);
  const topics = await GenTopic.find({ chapter: { $in: chapterIds } }).select(
    "_id"
  );
  const topicIds = topics.map((t) => t._id);
  await GenQuestion.deleteMany({ subject: subjectId });
  if (topicIds.length) await GenTopic.deleteMany({ _id: { $in: topicIds } });
  if (chapterIds.length)
    await GenChapter.deleteMany({ _id: { $in: chapterIds } });
}

async function replaceSubjectToMongo({
  classId,
  subjectId,
  syllabus,
  allQuestions,
}) {
  const meta = CLASS_META[classId];
  if (!meta) throw new Error("Bad classId " + classId);
  const slug = syllabus.slug;
  const subjectName = syllabus.subject;
  const keyPrefix = `pts:${classId}:${subjectId}:`;

  let board = await GenBoard.findOne({ code: "PTB" });
  if (!board) {
    board = await GenBoard.create({
      name: "PTB",
      code: "PTB",
      subtitle: "Syllabus",
      ptsCourseId: 1,
      sortOrder: 1,
    });
  }

  let klass = await GenClass.findOne({ board: board._id, ptsClassId: classId });
  if (!klass) {
    klass = await GenClass.create({
      board: board._id,
      name: meta.name,
      ptsClassId: classId,
      gradeLevel: meta.gradeLevel,
    });
  }

  const imageUrl = logoForSubjectSlug(slug) || "";
  let subject =
    (await GenSubject.findOne({ class: klass._id, slug })) ||
    (await GenSubject.findOne({ class: klass._id, name: subjectName }));
  if (!subject) {
    subject = await GenSubject.create({
      class: klass._id,
      name: subjectName,
      slug,
      imageUrl,
    });
  } else {
    let dirty = false;
    if (subject.name !== subjectName) {
      subject.name = subjectName;
      dirty = true;
    }
    if (subject.slug !== slug) {
      subject.slug = slug;
      dirty = true;
    }
    if (imageUrl && subject.imageUrl !== imageUrl) {
      subject.imageUrl = imageUrl;
      dirty = true;
    }
    if (dirty) await subject.save();
  }

  await wipeSubject(subject._id);

  const topicIdByCode = new Map();
  const usedChapterNames = new Set();
  for (const chapterData of syllabus.chapters || []) {
    let chapterName = `${chapterData.number}. ${chapterData.title}`;
    if (usedChapterNames.has(chapterName)) {
      chapterName = `${chapterData.number}. ${chapterData.title} (${chapterData._chapterId || usedChapterNames.size})`;
    }
    usedChapterNames.add(chapterName);
    const chapter = await GenChapter.create({
      subject: subject._id,
      name: chapterName,
      order: chapterData.number,
    });
    for (const topicData of chapterData.topics || []) {
      const topic = await GenTopic.create({
        chapter: chapter._id,
        name: `${topicData.id} ${topicData.title}`,
        order: topicOrder(topicData.id),
        code: topicData.id,
      });
      topicIdByCode.set(`${chapterData.number}:${topicData.id}`, topic);
      if (!topicIdByCode.has(topicData.id)) topicIdByCode.set(topicData.id, topic);
    }
  }

  let created = 0;
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
    typeCounts[type] = (typeCounts[type] || 0) + 1;
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
      externalKey: `${keyPrefix}${q.subTypeId || q.field || type}:${q.id}`,
    });
  }

  for (let i = 0; i < toCreate.length; i += MONGO_CHUNK) {
    const chunk = toCreate.slice(i, i + MONGO_CHUNK);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
      else if (err?.code === 11000) created += err.result?.nInserted || 0;
      else throw err;
    }
  }

  return {
    created,
    skipped,
    typeCounts,
    chapters: (syllabus.chapters || []).length,
    topics: (syllabus.chapters || []).reduce(
      (n, c) => n + (c.topics || []).length,
      0
    ),
  };
}

async function removeMongoOnlySubjects(classId, liveNames) {
  const meta = CLASS_META[classId];
  const board = await GenBoard.findOne({ code: "PTB" });
  const klass = await GenClass.findOne({ board: board._id, ptsClassId: classId });
  if (!klass) return { removed: [] };
  const liveSet = new Set(
    liveNames.map((n) =>
      String(n)
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
  );
  const mongoSubs = await GenSubject.find({ class: klass._id });
  const removed = [];
  for (const sub of mongoSubs) {
    const key = String(sub.name)
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (liveSet.has(key)) continue;
    await wipeSubject(sub._id);
    await GenSubject.deleteOne({ _id: sub._id });
    removed.push(sub.name);
  }
  return { removed, className: meta.name };
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

const DRIVER = fs.readFileSync(
  path.join(__dirname, "ptsLiveMatchBrowserDriver.browser.js"),
  "utf8"
);

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
console.log("Mongo connected");

const summary = [];

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  const urlPath = String(req.url || "").split("?")[0];
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, done: summary.length }));
    return;
  }
  if (req.method === "GET" && urlPath === "/driver.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
    });
    res.end(
      fs.readFileSync(
        path.join(__dirname, "ptsLiveMatchBrowserDriver.browser.js"),
        "utf8"
      )
    );
    return;
  }
  if (req.method === "GET" && urlPath === "/summary") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(summary, null, 2));
    return;
  }
  if (req.method === "POST" && urlPath === "/remove-extras") {
    try {
      const body = await readBody(req);
      const row = await removeMongoOnlySubjects(
        Number(body.classId),
        body.liveNames || []
      );
      summary.push({ action: "remove-extras", ...row, at: new Date().toISOString() });
      console.log("Removed extras class", body.classId, row.removed);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, row }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  if (req.method === "POST" && urlPath === "/subject") {
    try {
      const body = await readBody(req);
      const classId = Number(body.classId);
      const subjectId = Number(body.subjectId);
      const { slug, syllabus, allQuestions, meta } = body;
      if (!classId || !subjectId || !slug || !syllabus || !allQuestions) {
        throw new Error("Need classId, subjectId, slug, syllabus, allQuestions");
      }
      const outDir = path.join(DATA_ROOT, String(classId), slug);
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
        fs.mkdirSync(path.join(outDir, "pts-raw"), { recursive: true });
        fs.writeFileSync(
          path.join(outDir, "pts-raw", "hierarchy.json"),
          JSON.stringify(meta.hierarchy, null, 2)
        );
      }
      const mongo = await replaceSubjectToMongo({
        classId,
        subjectId,
        syllabus,
        allQuestions,
      });
      const row = {
        classId,
        subjectId,
        slug,
        name: syllabus.subject,
        total: allQuestions.total_questions,
        counts: allQuestions.counts,
        typeTotals: allQuestions.typeTotals,
        mongo,
        at: new Date().toISOString(),
      };
      summary.push(row);
      fs.writeFileSync(
        path.join(outDir, "_seed-result.json"),
        JSON.stringify(row, null, 2)
      );
      console.log(
        `✓ ${classId}/${slug}: Q=${row.total} +${mongo.created} skip ${mongo.skipped}`,
        mongo.typeCounts
      );
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
  console.log(`PTS MATCH ingest http://127.0.0.1:${PORT}`);
});
