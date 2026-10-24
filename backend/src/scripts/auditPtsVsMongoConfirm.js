/**
 * Confirm PTS live hierarchy dump vs Mongo for Class 9–12:
 *  - subjects present?
 *  - chapter/topic counts match?
 *  - per-chapter + all-chapters question type sets & counts vs seed JSON
 *
 * Usage:
 *   node src/scripts/auditPtsVsMongoConfirm.js <path-to-live-hierarchy.json>
 */
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
const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("Usage: node src/scripts/auditPtsVsMongoConfirm.js <live-dump.json>");
  process.exit(1);
}

const CLASS_MAP = {
  9: { name: "9TH", folder: "9th" },
  10: { name: "10TH", folder: "10th" },
  11: { name: "INTER-I", folder: "11th" },
  12: { name: "INTER-II", folder: "12th" },
};

function norm(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function chapterNum(name) {
  const m = String(name || "").match(
    /(?:CHAP(?:TER)?|UNIT|باب)?\s*(\d+)\s*[:.\-)]/i
  );
  if (m) return Number(m[1]);
  const m2 = String(name || "").match(/^(\d+)\s*[.\-)]/);
  return m2 ? Number(m2[1]) : null;
}

function mapType(t) {
  if (t === "long" || t === "LONG") return "LONG";
  if (t === "mcq" || t === "MCQ") return "MCQ";
  return "SHORT";
}

function typeKey(type, field) {
  return `${mapType(type)}:${String(field || mapType(type)).toUpperCase()}`;
}

function loadSeedQuestions(grade, slug) {
  const meta = CLASS_MAP[grade];
  const candidates = [
    path.resolve(
      __dirname,
      `../../data/pts-live/PTB/${grade}/${slug}/all-questions.json`
    ),
    path.resolve(
      __dirname,
      `../../data/lahore-board/${meta.folder}/${slug}/all-questions.json`
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        /* next */
      }
    }
  }
  return null;
}

function seedTypeTotals(seed) {
  const all = {};
  const byChapter = {};
  for (const q of seed.questions || []) {
    const k = typeKey(q.type, q.field);
    all[k] = (all[k] || 0) + 1;
    const ch = String(q.chapter ?? "?");
    if (!byChapter[ch]) byChapter[ch] = {};
    byChapter[ch][k] = (byChapter[ch][k] || 0) + 1;
  }
  return { all, byChapter };
}

async function mongoTypeTotals(subjectId) {
  const rows = await GenQuestion.aggregate([
    { $match: { subject: subjectId, isActive: { $ne: false } } },
    {
      $group: {
        _id: { type: "$type", subType: "$subType", chapter: "$chapter" },
        n: { $sum: 1 },
      },
    },
  ]);
  const chapters = await GenChapter.find({ subject: subjectId })
    .select("_id order name")
    .lean();
  const orderById = new Map(
    chapters.map((c) => [String(c._id), c.order ?? chapterNum(c.name)])
  );
  const all = {};
  const byChapter = {};
  for (const r of rows) {
    const k = typeKey(r._id.type, r._id.subType);
    all[k] = (all[k] || 0) + r.n;
    const ord = orderById.get(String(r._id.chapter));
    const ch = ord != null ? String(ord) : "?";
    if (!byChapter[ch]) byChapter[ch] = {};
    byChapter[ch][k] = (byChapter[ch][k] || 0) + r.n;
  }
  return { all, byChapter };
}

function sameKeys(a, b) {
  const ak = Object.keys(a || {}).sort();
  const bk = Object.keys(b || {}).sort();
  return (
    ak.length === bk.length && ak.every((k, i) => k === bk[i])
  );
}

function countsEqual(a, b) {
  if (!sameKeys(a, b)) return false;
  return Object.keys(a).every((k) => a[k] === b[k]);
}

function findMongoSubject(mongoSubs, liveName) {
  const n = norm(liveName);
  let hit = mongoSubs.find((s) => norm(s.name) === n);
  if (hit) return hit;
  const slug = slugify(liveName);
  hit = mongoSubs.find((s) => s.slug === slug);
  if (hit) return hit;
  // loose: strip (TECH) spacing
  return mongoSubs.find(
    (s) => norm(s.name).replace(/\s+/g, "") === n.replace(/\s+/g, "")
  );
}

const live = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const board = await GenBoard.findOne({ code: "PTB" });
if (!board) throw new Error("PTB board missing");

const report = {
  at: new Date().toISOString(),
  source: dumpPath,
  summary: {
    classes: {},
    overallOk: true,
  },
  classes: {},
};

for (const [gradeStr, liveSubs] of Object.entries(live.classes || {})) {
  const grade = Number(gradeStr);
  const meta = CLASS_MAP[grade];
  if (!meta) continue;
  const klass = await GenClass.findOne({
    board: board._id,
    ptsClassId: grade,
  }).lean();
  const classReport = {
    className: meta.name,
    liveSubjects: liveSubs.length,
    mongoSubjects: 0,
    subjectListMatch: false,
    onlyLive: [],
    onlyMongo: [],
    subjects: [],
  };

  if (!klass) {
    classReport.error = "Mongo class missing";
    report.summary.overallOk = false;
    report.classes[grade] = classReport;
    continue;
  }

  const mongoSubs = await GenSubject.find({ class: klass._id }).lean();
  classReport.mongoSubjects = mongoSubs.length;

  const liveCore = liveSubs; // include TECH — user asked all PTS subjects
  const onlyLive = liveCore
    .filter((l) => !findMongoSubject(mongoSubs, l.name))
    .map((l) => l.name);
  const onlyMongo = mongoSubs
    .filter((m) => !liveCore.some((l) => findMongoSubject([m], l.name)))
    .map((m) => m.name);
  classReport.onlyLive = onlyLive;
  classReport.onlyMongo = onlyMongo;
  classReport.subjectListMatch = onlyLive.length === 0 && onlyMongo.length === 0;

  let allSubjectsOk = classReport.subjectListMatch;

  for (const liveSub of liveCore) {
    const m = findMongoSubject(mongoSubs, liveSub.name);
    const row = {
      name: liveSub.name,
      isTech: !!liveSub.isTech,
      foundInMongo: Boolean(m),
      liveChapters: liveSub.chapterCount,
      liveTopics: liveSub.topicCount,
      mongoChapters: 0,
      mongoTopics: 0,
      chapterCountMatch: false,
      topicCountMatch: false,
      seedFound: false,
      allChaptersTypesMatch: null,
      allChaptersCountsMatch: null,
      perChapterTypesMatch: null,
      perChapterCountsMatch: null,
      issues: [],
    };

    if (!m) {
      row.issues.push("missing in Mongo");
      allSubjectsOk = false;
      classReport.subjects.push(row);
      continue;
    }

    const chapters = await GenChapter.find({ subject: m._id })
      .sort({ order: 1 })
      .lean();
    const topics = await GenTopic.find({
      chapter: { $in: chapters.map((c) => c._id) },
    }).lean();
    row.mongoChapters = chapters.length;
    row.mongoTopics = topics.length;
    row.chapterCountMatch = row.liveChapters === row.mongoChapters;
    row.topicCountMatch = row.liveTopics === row.mongoTopics;
    if (!row.chapterCountMatch)
      row.issues.push(
        `chapters live=${row.liveChapters} mongo=${row.mongoChapters}`
      );
    if (!row.topicCountMatch)
      row.issues.push(
        `topics live=${row.liveTopics} mongo=${row.mongoTopics}`
      );

    const seed = loadSeedQuestions(grade, m.slug);
    if (!seed) {
      row.seedFound = false;
      row.issues.push("no seed JSON — cannot confirm type/count vs PTS dump");
      // still report mongo type totals
      const mongoTot = await mongoTypeTotals(m._id);
      row.mongoTypeTotals = mongoTot.all;
      if (Object.keys(mongoTot.all).length === 0 && row.liveTopics > 0) {
        row.issues.push("mongo has 0 questions");
      }
      if (row.issues.length) allSubjectsOk = false;
      classReport.subjects.push(row);
      continue;
    }

    row.seedFound = true;
    const seedTot = seedTypeTotals(seed);
    const mongoTot = await mongoTypeTotals(m._id);
    row.seedTypeTotals = seedTot.all;
    row.mongoTypeTotals = mongoTot.all;
    row.allChaptersTypesMatch = sameKeys(seedTot.all, mongoTot.all);
    row.allChaptersCountsMatch = countsEqual(seedTot.all, mongoTot.all);

    // per-chapter: compare chapters present in seed
    const chKeys = new Set([
      ...Object.keys(seedTot.byChapter),
      ...Object.keys(mongoTot.byChapter),
    ]);
    let perTypesOk = true;
    let perCountsOk = true;
    const chapterMismatches = [];
    for (const ch of [...chKeys].sort()) {
      const s = seedTot.byChapter[ch] || {};
      const g = mongoTot.byChapter[ch] || {};
      if (!sameKeys(s, g)) {
        perTypesOk = false;
        chapterMismatches.push({ chapter: ch, issue: "types", seed: s, mongo: g });
      } else if (!countsEqual(s, g)) {
        perCountsOk = false;
        chapterMismatches.push({
          chapter: ch,
          issue: "counts",
          seed: s,
          mongo: g,
        });
      }
    }
    row.perChapterTypesMatch = perTypesOk;
    row.perChapterCountsMatch = perCountsOk;
    if (chapterMismatches.length)
      row.chapterMismatches = chapterMismatches.slice(0, 8);

    if (!row.chapterCountMatch || !row.topicCountMatch) allSubjectsOk = false;
    if (!row.allChaptersTypesMatch || !row.allChaptersCountsMatch)
      allSubjectsOk = false;
    if (!row.perChapterTypesMatch || !row.perChapterCountsMatch)
      allSubjectsOk = false;
    if (!row.allChaptersTypesMatch)
      row.issues.push("all-chapters question types differ (seed vs mongo)");
    if (!row.allChaptersCountsMatch)
      row.issues.push("all-chapters question counts differ (seed vs mongo)");
    if (!row.perChapterTypesMatch)
      row.issues.push("per-chapter question types differ");
    if (!row.perChapterCountsMatch)
      row.issues.push("per-chapter question counts differ");

    classReport.subjects.push(row);
  }

  classReport.allOk = allSubjectsOk && classReport.subjectListMatch;
  if (!classReport.allOk) report.summary.overallOk = false;
  report.summary.classes[grade] = {
    allOk: classReport.allOk,
    live: classReport.liveSubjects,
    mongo: classReport.mongoSubjects,
    subjectListMatch: classReport.subjectListMatch,
    issues: classReport.subjects.filter((s) => s.issues?.length).length,
  };
  report.classes[grade] = classReport;
}

const outPath = path.resolve(
  __dirname,
  "../../data/lahore-board/_audit-pts-vs-mongo-confirm.json"
);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("\n=== PTS vs Mongo CONFIRM (Class 9–12) ===\n");
for (const [grade, sum] of Object.entries(report.summary.classes)) {
  const mark = sum.allOk ? "✓" : "✗";
  console.log(
    `${mark} Class ${grade}: subjects live=${sum.live} mongo=${sum.mongo} listMatch=${sum.subjectListMatch} subjectsWithIssues=${sum.issues}`
  );
}
console.log(`\nOverall OK: ${report.summary.overallOk}`);
console.log(`Report: ${outPath}`);

// Print compact per-subject failures
for (const [grade, cr] of Object.entries(report.classes)) {
  const bad = (cr.subjects || []).filter((s) => s.issues?.length);
  if (!bad.length && !cr.onlyLive?.length && !cr.onlyMongo?.length) continue;
  console.log(`\n── Class ${grade} problems ──`);
  if (cr.onlyLive?.length)
    console.log("  only in PTS:", cr.onlyLive.join(" | "));
  if (cr.onlyMongo?.length)
    console.log("  only in Mongo:", cr.onlyMongo.join(" | "));
  for (const s of bad) {
    console.log(`  • ${s.name}: ${s.issues.join("; ")}`);
  }
}

await mongoose.disconnect();
