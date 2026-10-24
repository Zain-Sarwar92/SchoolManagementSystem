/**
 * Compare live PTS website dump vs Mongo Gen* bank.
 * Input: browser CDP dump of SubjectsList + ChaptersList/TopicsList
 *
 * Usage:
 *   node src/scripts/verifyPtsLiveVsMongo.js <path-to-cdp-json>
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenChapter from "../models/generator/GenChapter.js";
import GenTopic from "../models/generator/GenTopic.js";
import GenQuestion from "../models/generator/GenQuestion.js";

const CLASS_MAP = {
  9: "9TH",
  10: "10TH",
  11: "INTER-I",
  12: "INTER-II",
};

function norm(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** PTS "CHAP 1: Title" → our "1. Title" style for loose compare */
function chapterKey(name) {
  const n = String(name || "").trim();
  const m = n.match(/^(?:CHAP(?:TER)?\s*)?(\d+)\s*[:.\-)]\s*(.+)$/i);
  if (m) return `${m[1]}|${norm(m[2])}`;
  return `|${norm(n)}`;
}

function topicKey(name) {
  return norm(name);
}

function loadPtsDump(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const value = raw?.result?.value ?? raw;
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function loadMongo() {
  const board = await GenBoard.findOne({ name: "PTB" }).lean();
  if (!board) throw new Error("PTB board missing in Mongo");
  const tree = {};
  for (const [grade, className] of Object.entries(CLASS_MAP)) {
    const klass = await GenClass.findOne({
      board: board._id,
      name: className,
    }).lean();
    if (!klass) {
      tree[grade] = [];
      continue;
    }
    const subjects = await GenSubject.find({ class: klass._id })
      .sort({ name: 1 })
      .lean();
    const rows = [];
    for (const sub of subjects) {
      const chapters = await GenChapter.find({ subject: sub._id })
        .sort({ order: 1 })
        .lean();
      const chapterIds = chapters.map((c) => c._id);
      const topics = await GenTopic.find({ chapter: { $in: chapterIds } })
        .sort({ order: 1 })
        .lean();
      const byCh = new Map();
      for (const t of topics) {
        const k = String(t.chapter);
        if (!byCh.has(k)) byCh.set(k, []);
        byCh.get(k).push(t);
      }
      const counts = await GenQuestion.aggregate([
        { $match: { subject: sub._id, isActive: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]);
      const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
      for (const row of counts) {
        if (typeCounts[row._id] !== undefined) typeCounts[row._id] = row.count;
      }
      rows.push({
        name: sub.name,
        chapterCount: chapters.length,
        topicCount: topics.length,
        chapters: chapters.map((c) => ({
          name: c.name,
          topics: (byCh.get(String(c._id)) || []).map((t) => t.name),
        })),
        typeCounts,
      });
    }
    tree[grade] = rows;
  }
  return tree;
}

function findMongoSubject(mongoSubjects, ptsName) {
  const n = norm(ptsName);
  return (
    mongoSubjects.find((s) => norm(s.name) === n) ||
    mongoSubjects.find((s) => norm(s.name) === n.replace(/\s+/g, " ")) ||
    null
  );
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath || !fs.existsSync(dumpPath)) {
    throw new Error("Pass path to live PTS CDP dump JSON");
  }

  const pts = loadPtsDump(dumpPath);
  await mongoose.connect(process.env.MONGO_URI);
  const mongo = await loadMongo();

  const report = {
    source: "https://paktestsolution.com (live browser session)",
    generatedAt: new Date().toISOString(),
    classes: {},
    summary: {
      subjectsCoreMatch: true,
      chaptersMatch: true,
      topicsMatch: true,
      subjectIssues: [],
      chapterIssues: [],
      topicIssues: [],
    },
  };

  console.log("=== LIVE PTS website vs Mongo ===\n");

  for (const grade of [9, 10, 11, 12]) {
    const className = CLASS_MAP[grade];
    const liveAll = pts[grade] || [];
    const liveCore = liveAll.filter((s) => !s.isTech && !s.skipped);
    const liveTech = liveAll.filter((s) => s.isTech);
    const mongoSubs = mongo[grade] || [];

    console.log(`── ${className} ──`);
    console.log(
      `  Live PTS: ${liveAll.length} subjects (${liveCore.length} core + ${liveTech.length} TECH)`
    );
    console.log(`  Mongo:    ${mongoSubs.length} subjects`);

    const liveNames = liveCore.map((s) => s.name);
    const mongoNames = mongoSubs.map((s) => s.name);
    const onlyLive = liveNames.filter(
      (n) => !mongoSubs.some((m) => norm(m.name) === norm(n))
    );
    const onlyMongo = mongoNames.filter(
      (n) => !liveCore.some((l) => norm(l.name) === norm(n))
    );

    if (onlyLive.length || onlyMongo.length) {
      report.summary.subjectsCoreMatch = false;
      report.summary.subjectIssues.push({
        class: className,
        onlyLive,
        onlyMongo,
        liveTech: liveTech.map((s) => s.name),
      });
      console.log(`  !! Subject mismatch (core PTB)`);
      if (onlyLive.length)
        console.log(`     only live PTS: ${onlyLive.join(" | ")}`);
      if (onlyMongo.length)
        console.log(`     only Mongo: ${onlyMongo.join(" | ")}`);
    } else {
      console.log(`  ✓ Core subject list match (${liveCore.length})`);
    }
    if (liveTech.length) {
      console.log(
        `  · Live TECH extras (not in our bank): ${liveTech.map((s) => s.name).join(", ")}`
      );
    }

    const classReport = {
      liveTotal: liveAll.length,
      liveCore: liveCore.length,
      liveTech: liveTech.length,
      mongo: mongoSubs.length,
      subjects: [],
    };

    for (const live of liveCore) {
      const m = findMongoSubject(mongoSubs, live.name);
      const row = {
        name: live.name,
        found: Boolean(m),
        liveChapters: live.chapterCount ?? 0,
        liveTopics: live.topicCount ?? 0,
        mongoChapters: m?.chapterCount ?? 0,
        mongoTopics: m?.topicCount ?? 0,
        chapterMatch: false,
        topicMatch: false,
        typeCountsMongo: m?.typeCounts || null,
      };

      if (!m) {
        console.log(`  ✗ Missing in Mongo: ${live.name}`);
        classReport.subjects.push(row);
        continue;
      }

      row.chapterMatch = row.liveChapters === row.mongoChapters;
      row.topicMatch = row.liveTopics === row.mongoTopics;

      // deeper name checks
      const liveChKeys = (live.chapters || []).map((c) => chapterKey(c.name));
      const mongoChKeys = (m.chapters || []).map((c) => chapterKey(c.name));
      const chOnlyLive = liveChKeys.filter((k) => !mongoChKeys.includes(k));
      const chOnlyMongo = mongoChKeys.filter((k) => !liveChKeys.includes(k));

      if (!row.chapterMatch || chOnlyLive.length || chOnlyMongo.length) {
        report.summary.chaptersMatch = false;
        report.summary.chapterIssues.push({
          class: className,
          subject: live.name,
          live: row.liveChapters,
          mongo: row.mongoChapters,
          onlyLiveSample: chOnlyLive.slice(0, 5),
          onlyMongoSample: chOnlyMongo.slice(0, 5),
        });
        console.log(
          `  ✗ ${live.name}: chapters live ${row.liveChapters} vs mongo ${row.mongoChapters}`
        );
      }

      const liveTopicKeys = (live.chapters || []).flatMap((c) =>
        (c.topicNames || []).map((t) => topicKey(t))
      );
      const mongoTopicKeys = (m.chapters || []).flatMap((c) =>
        (c.topics || []).map((t) => {
          // strip leading "1.1 " codes from our names for compare
          return topicKey(String(t).replace(/^[0-9]+(?:\.[0-9A-Z]+)?\s+/, ""));
        })
      );
      // also try raw compare counts first
      if (!row.topicMatch) {
        report.summary.topicsMatch = false;
        report.summary.topicIssues.push({
          class: className,
          subject: live.name,
          live: row.liveTopics,
          mongo: row.mongoTopics,
        });
        console.log(
          `  ✗ ${live.name}: topics live ${row.liveTopics} vs mongo ${row.mongoTopics}`
        );
      } else if (row.chapterMatch) {
        console.log(
          `  ✓ ${live.name}: ch ${row.liveChapters}, topics ${row.liveTopics}`
        );
      }

      classReport.subjects.push(row);
    }

    report.classes[className] = classReport;
    console.log("");
  }

  const outPath = path.resolve(
    __dirname,
    "../../data/lahore-board/_verify-pts-live-vs-mongo.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("═══ SUMMARY (live website) ═══");
  console.log(
    `Subjects (core): ${report.summary.subjectsCoreMatch ? "MATCH" : "MISMATCH"}`
  );
  console.log(
    `Chapters: ${report.summary.chaptersMatch ? "MATCH" : "MISMATCH"}`
  );
  console.log(`Topics: ${report.summary.topicsMatch ? "MATCH" : "MISMATCH"}`);
  console.log(`Subject issues: ${report.summary.subjectIssues.length}`);
  console.log(`Chapter issues: ${report.summary.chapterIssues.length}`);
  console.log(`Topic issues: ${report.summary.topicIssues.length}`);
  console.log(`Report: ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
