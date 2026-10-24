/**
 * PTS seed JSON (data/lahore-board/{9th|10th|11th|12th}) vs Mongo Gen* bank.
 * Checks per subject:
 *  - All-topics: question type/field set + counts
 *  - Per chapter: type/field set + question counts
 *
 * Usage:
 *   node src/scripts/comparePtsVsMongoClass.js 11
 *   node src/scripts/comparePtsVsMongoClass.js 12
 *   node src/scripts/comparePtsVsMongoClass.js 10 english
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

const CLASS_MAP = {
  9: { folder: "9th", name: "9TH" },
  10: { folder: "10th", name: "10TH" },
  11: { folder: "11th", name: "INTER-I" },
  12: { folder: "12th", name: "INTER-II" },
};

const gradeArg = Number(process.argv[2]);
const ONLY = (process.argv[3] || "").toLowerCase() || null;

if (!CLASS_MAP[gradeArg]) {
  console.error("Usage: node src/scripts/comparePtsVsMongoClass.js <9|10|11|12> [subject-slug]");
  process.exit(1);
}

const CLASS_META = CLASS_MAP[gradeArg];
const DATA_ROOT = path.resolve(
  __dirname,
  `../../data/lahore-board/${CLASS_META.folder}`
);
const OUT_PATH = path.resolve(
  DATA_ROOT,
  `_class${gradeArg}-pts-vs-mongo-report.json`
);

function slugKey(s) {
  return String(s || "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}

function mapType(type) {
  if (type === "long" || type === "LONG") return "LONG";
  if (type === "mcq" || type === "MCQ") return "MCQ";
  return "SHORT";
}

function typeKey(type, field) {
  return `${mapType(type)}:${String(field || mapType(type)).toUpperCase()}`;
}

function chapterNumFromName(name) {
  const m = String(name || "").match(/^(\d+)\s*[.\-)]/);
  return m ? Number(m[1]) : null;
}

function listSubjects() {
  if (!fs.existsSync(DATA_ROOT)) return [];
  return fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter(
      (name) =>
        fs.existsSync(path.join(DATA_ROOT, name, "syllabus.json")) &&
        fs.existsSync(path.join(DATA_ROOT, name, "all-questions.json"))
    )
    .filter((name) => !ONLY || name === ONLY || slugKey(name) === ONLY)
    .sort();
}

function loadPtsSubject(folder) {
  const dir = path.join(DATA_ROOT, folder);
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(dir, "syllabus.json"), "utf8")
  );
  const qFile = JSON.parse(
    fs.readFileSync(path.join(dir, "all-questions.json"), "utf8")
  );
  const questions = qFile.questions || [];

  const byChapter = new Map();
  const allTypes = new Map();

  for (const q of questions) {
    const ch = Number(q.chapter);
    const key = typeKey(q.type, q.field);
    allTypes.set(key, (allTypes.get(key) || 0) + 1);
    if (!byChapter.has(ch)) byChapter.set(ch, new Map());
    const m = byChapter.get(ch);
    m.set(key, (m.get(key) || 0) + 1);
  }

  const chapters = (syllabus.chapters || []).map((ch) => {
    const counts = byChapter.get(ch.number) || new Map();
    return {
      number: ch.number,
      title: ch.title,
      topicCount: (ch.topics || []).length,
      types: Object.fromEntries([...counts.entries()].sort()),
      total: [...counts.values()].reduce((a, b) => a + b, 0),
    };
  });

  return {
    folder,
    name: syllabus.subject,
    slug: slugKey(syllabus.slug || folder),
    chapterCount: chapters.length,
    questionTotal: questions.length,
    allTopicsTypes: Object.fromEntries([...allTypes.entries()].sort()),
    chapters,
  };
}

async function loadMongoSubject(sub) {
  const chapters = await GenChapter.find({ subject: sub._id })
    .sort({ order: 1 })
    .lean();
  const chapterIds = chapters.map((c) => c._id);
  const topics = await GenTopic.find({ chapter: { $in: chapterIds } }).lean();
  const topicsByCh = new Map();
  for (const t of topics) {
    const k = String(t.chapter);
    topicsByCh.set(k, (topicsByCh.get(k) || 0) + 1);
  }

  const chapterMeta = new Map(
    chapters.map((c) => [
      String(c._id),
      {
        number: chapterNumFromName(c.name) ?? c.order + 1,
        name: c.name,
      },
    ])
  );

  const rows = await GenQuestion.aggregate([
    { $match: { subject: sub._id, isActive: true } },
    {
      $group: {
        _id: {
          chapterId: "$chapter",
          type: "$type",
          subType: "$subType",
        },
        n: { $sum: 1 },
      },
    },
  ]);

  const allTypes = new Map();
  const byChapter = new Map();

  for (const row of rows) {
    const key = typeKey(row._id.type, row._id.subType);
    allTypes.set(key, (allTypes.get(key) || 0) + row.n);
    const meta = chapterMeta.get(String(row._id.chapterId));
    if (!meta) continue;
    if (!byChapter.has(meta.number)) {
      byChapter.set(meta.number, {
        number: meta.number,
        name: meta.name,
        types: new Map(),
        total: 0,
      });
    }
    const ch = byChapter.get(meta.number);
    ch.types.set(key, (ch.types.get(key) || 0) + row.n);
    ch.total += row.n;
  }

  return {
    name: sub.name,
    slug: slugKey(sub.slug),
    chapterCount: chapters.length,
    topicCount: topics.length,
    questionTotal: [...allTypes.values()].reduce((a, b) => a + b, 0),
    allTopicsTypes: Object.fromEntries([...allTypes.entries()].sort()),
    chapters: chapters.map((c) => {
      const num = chapterNumFromName(c.name) ?? c.order + 1;
      const info = byChapter.get(num);
      return {
        number: num,
        title: c.name,
        topicCount: topicsByCh.get(String(c._id)) || 0,
        types: info
          ? Object.fromEntries([...info.types.entries()].sort())
          : {},
        total: info?.total || 0,
      };
    }),
  };
}

function diffMaps(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const onlyPts = [];
  const onlyMongo = [];
  const countMismatch = [];
  for (const k of [...keys].sort()) {
    const av = a?.[k] || 0;
    const bv = b?.[k] || 0;
    if (av && !bv) onlyPts.push({ type: k, pts: av });
    else if (!av && bv) onlyMongo.push({ type: k, mongo: bv });
    else if (av !== bv) countMismatch.push({ type: k, pts: av, mongo: bv });
  }
  return {
    typesMatch: onlyPts.length === 0 && onlyMongo.length === 0,
    countsMatch:
      countMismatch.length === 0 &&
      onlyPts.length === 0 &&
      onlyMongo.length === 0,
    onlyPts,
    onlyMongo,
    countMismatch,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const board = await GenBoard.findOne({ name: "PTB" }).lean();
  if (!board) throw new Error("PTB board missing");
  const klass = await GenClass.findOne({
    board: board._id,
    name: CLASS_META.name,
  }).lean();
  if (!klass) throw new Error(`${CLASS_META.name} missing in Mongo`);

  const mongoSubjects = await GenSubject.find({ class: klass._id })
    .sort({ name: 1 })
    .lean();
  const mongoBySlug = new Map(mongoSubjects.map((s) => [slugKey(s.slug), s]));
  const mongoByName = new Map(
    mongoSubjects.map((s) => [s.name.trim().toLowerCase(), s])
  );

  const folders = listSubjects();
  const report = {
    generatedAt: new Date().toISOString(),
    class: CLASS_META.name,
    source: `data/lahore-board/${CLASS_META.folder} (PTS export) vs Mongo Gen*`,
    note: "This compares local PTS seed dumps, not a fresh live scrape.",
    ptsSubjectFolders: folders.length,
    mongoSubjectCount: mongoSubjects.length,
    subjects: [],
    summary: {
      subjectsCompared: 0,
      missingInMongo: [],
      allTopicsTypeOk: 0,
      allTopicsTypeFail: 0,
      allTopicsCountOk: 0,
      allTopicsCountFail: 0,
      chaptersTypeOk: 0,
      chaptersTypeFail: 0,
      chaptersCountOk: 0,
      chaptersCountFail: 0,
    },
  };

  console.log(
    `=== ${CLASS_META.name}: PTS dump vs Mongo (types + chapter questions) ===\n`
  );
  console.log(
    `PTS folders: ${folders.length} | Mongo subjects: ${mongoSubjects.length}\n`
  );

  for (const folder of folders) {
    const pts = loadPtsSubject(folder);
    const mongoDoc =
      mongoBySlug.get(pts.slug) ||
      mongoByName.get(pts.name.trim().toLowerCase());

    if (!mongoDoc) {
      report.summary.missingInMongo.push(pts.name);
      console.log(`✗ ${pts.name} (${folder}) — MISSING in Mongo`);
      report.subjects.push({
        name: pts.name,
        folder,
        foundInMongo: false,
      });
      continue;
    }

    const mongo = await loadMongoSubject(mongoDoc);
    report.summary.subjectsCompared += 1;

    const allDiff = diffMaps(pts.allTopicsTypes, mongo.allTopicsTypes);
    if (allDiff.typesMatch) report.summary.allTopicsTypeOk += 1;
    else report.summary.allTopicsTypeFail += 1;
    if (allDiff.countsMatch) report.summary.allTopicsCountOk += 1;
    else report.summary.allTopicsCountFail += 1;

    const chapterRows = [];
    const ptsByNum = new Map(pts.chapters.map((c) => [c.number, c]));
    const mongoByNum = new Map(mongo.chapters.map((c) => [c.number, c]));
    const allNums = [
      ...new Set([...ptsByNum.keys(), ...mongoByNum.keys()]),
    ].sort((a, b) => a - b);

    for (const num of allNums) {
      const p = ptsByNum.get(num);
      const m = mongoByNum.get(num);
      if (!p || !m) {
        chapterRows.push({
          chapter: num,
          status: !p ? "only_mongo" : "only_pts",
          typesMatch: false,
          countsMatch: false,
          ptsTotal: p?.total ?? 0,
          mongoTotal: m?.total ?? 0,
        });
        report.summary.chaptersTypeFail += 1;
        report.summary.chaptersCountFail += 1;
        continue;
      }
      const d = diffMaps(p.types, m.types);
      if (d.typesMatch) report.summary.chaptersTypeOk += 1;
      else report.summary.chaptersTypeFail += 1;
      if (d.countsMatch) report.summary.chaptersCountOk += 1;
      else report.summary.chaptersCountFail += 1;
      chapterRows.push({
        chapter: num,
        title: p.title,
        typesMatch: d.typesMatch,
        countsMatch: d.countsMatch,
        ptsTotal: p.total,
        mongoTotal: m.total,
        onlyPts: d.onlyPts,
        onlyMongo: d.onlyMongo,
        countMismatch: d.countMismatch,
      });
    }

    const row = {
      name: pts.name,
      folder,
      foundInMongo: true,
      chapterCount: { pts: pts.chapterCount, mongo: mongo.chapterCount },
      questionTotal: { pts: pts.questionTotal, mongo: mongo.questionTotal },
      allTopics: {
        typesMatch: allDiff.typesMatch,
        countsMatch: allDiff.countsMatch,
        ptsTypes: pts.allTopicsTypes,
        mongoTypes: mongo.allTopicsTypes,
        onlyPts: allDiff.onlyPts,
        onlyMongo: allDiff.onlyMongo,
        countMismatch: allDiff.countMismatch,
      },
      chapters: chapterRows,
    };
    report.subjects.push(row);

    const typeMark = allDiff.typesMatch ? "✓" : "✗";
    const countMark = allDiff.countsMatch ? "✓" : "✗";
    const chTypeOk = chapterRows.filter((c) => c.typesMatch).length;
    const chCountOk = chapterRows.filter((c) => c.countsMatch).length;
    console.log(
      `${typeMark}${countMark} ${pts.name}: all-topics types ${allDiff.typesMatch ? "SAME" : "DIFF"} | counts ${allDiff.countsMatch ? "SAME" : "DIFF"} | Q pts=${pts.questionTotal} mongo=${mongo.questionTotal}`
    );
    console.log(
      `   chapters: types ${chTypeOk}/${chapterRows.length} match | counts ${chCountOk}/${chapterRows.length} match`
    );
    if (!allDiff.typesMatch) {
      if (allDiff.onlyPts.length)
        console.log(
          `   only PTS types: ${allDiff.onlyPts.map((x) => `${x.type}(${x.pts})`).join(", ")}`
        );
      if (allDiff.onlyMongo.length)
        console.log(
          `   only Mongo types: ${allDiff.onlyMongo.map((x) => `${x.type}(${x.mongo})`).join(", ")}`
        );
    } else if (!allDiff.countsMatch) {
      console.log(
        `   count diffs: ${allDiff.countMismatch
          .slice(0, 8)
          .map((x) => `${x.type} pts=${x.pts} mongo=${x.mongo}`)
          .join("; ")}${allDiff.countMismatch.length > 8 ? " ..." : ""}`
      );
    }

    const badCh = chapterRows.filter((c) => !c.typesMatch || !c.countsMatch);
    if (badCh.length && badCh.length <= 12) {
      for (const c of badCh) {
        if (c.status) {
          console.log(`   ch${c.chapter}: ${c.status}`);
          continue;
        }
        if (!c.typesMatch) {
          console.log(
            `   ch${c.chapter} types DIFF: onlyPts=${JSON.stringify(c.onlyPts)} onlyMongo=${JSON.stringify(c.onlyMongo)}`
          );
        } else if (!c.countsMatch) {
          console.log(
            `   ch${c.chapter} counts DIFF (pts=${c.ptsTotal} mongo=${c.mongoTotal}): ${JSON.stringify(c.countMismatch?.slice(0, 5))}`
          );
        }
      }
    } else if (badCh.length > 12) {
      console.log(
        `   ${badCh.length} chapters with type/count diffs (see JSON report)`
      );
    }
    console.log("");
  }

  const ptsNames = new Set(
    report.subjects.map((s) => s.name?.trim().toLowerCase()).filter(Boolean)
  );
  const onlyMongo = mongoSubjects
    .filter((s) => !ptsNames.has(s.name.trim().toLowerCase()))
    .map((s) => s.name);
  report.subjectsOnlyInMongo = onlyMongo;

  console.log("── SUMMARY ──");
  console.log(`Compared: ${report.summary.subjectsCompared}`);
  console.log(
    `Missing in Mongo: ${report.summary.missingInMongo.join(", ") || "none"}`
  );
  console.log(
    `All-topics types OK/FAIL: ${report.summary.allTopicsTypeOk}/${report.summary.allTopicsTypeFail}`
  );
  console.log(
    `All-topics counts OK/FAIL: ${report.summary.allTopicsCountOk}/${report.summary.allTopicsCountFail}`
  );
  console.log(
    `Chapter types OK/FAIL: ${report.summary.chaptersTypeOk}/${report.summary.chaptersTypeFail}`
  );
  console.log(
    `Chapter counts OK/FAIL: ${report.summary.chaptersCountOk}/${report.summary.chaptersCountFail}`
  );
  if (onlyMongo.length)
    console.log(`Only in Mongo (no PTS folder match): ${onlyMongo.join(", ")}`);

  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReport: ${OUT_PATH}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
