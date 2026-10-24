/**
 * Verify PTB Class 9–12: source JSON (PTS seed) vs Mongo Gen* bank.
 * Checks: subjects, chapters, topics, question types, counts per type.
 *
 * Usage: node src/scripts/verifyPtbVsMongo.js
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
const DATA_ROOT = path.resolve(__dirname, "../../data/lahore-board");

const CLASS_FOLDERS = {
  "9th": { grade: 9, name: "9TH" },
  "10th": { grade: 10, name: "10TH" },
  "11th": { grade: 11, name: "INTER-I" },
  "12th": { grade: 12, name: "INTER-II" },
};

function slugKey(slug) {
  return String(slug || "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}

const ALL_TYPES = ["MCQ", "SHORT", "LONG"];

function mapType(type) {
  if (type === "long") return "LONG";
  if (type === "mcq") return "MCQ";
  return "SHORT";
}

function normalizeMcqOk(q) {
  const letters = ["A", "B", "C", "D"];
  const raw = [q.optionA, q.optionB, q.optionC, q.optionD];
  const options = raw.map((value, index) => {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    const letter = letters[index];
    if (q.correctAnswer?.toUpperCase() === letter) return "—";
    return null;
  });
  return Boolean(q.correctAnswer && options.every((v) => v));
}

function resolveQuestionText(q) {
  const text = q.en?.trim();
  if (text && text !== ".") return text;
  if (q.field === "SPELLING") return "Tick the correct spelling.";
  if (q.type === "mcq") return q.source?.trim() || "Select the correct option.";
  return q.ur?.trim() || "";
}

function chapterNameFrom(ch) {
  return `${ch.number}. ${ch.title}`;
}

function topicNameFrom(t) {
  return `${t.id} ${t.title}`;
}

function listSourceSubjects(classFolder) {
  const classDir = path.join(DATA_ROOT, classFolder);
  if (!fs.existsSync(classDir)) return [];
  return fs
    .readdirSync(classDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter(
      (name) =>
        fs.existsSync(path.join(classDir, name, "syllabus.json")) &&
        fs.existsSync(path.join(classDir, name, "all-questions.json"))
    )
    .sort();
}

function loadSourceSubject(classFolder, subjectSlug) {
  const dataDir = path.join(DATA_ROOT, classFolder, subjectSlug);
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8")
  );
  const questionsFile = JSON.parse(
    fs.readFileSync(path.join(dataDir, "all-questions.json"), "utf8")
  );

  const chapters = (syllabus.chapters || []).map((ch) => ({
    number: ch.number,
    name: chapterNameFrom(ch),
    topics: (ch.topics || []).map((t) => ({
      id: t.id,
      name: topicNameFrom(t),
    })),
  }));

  const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
  let importable = 0;
  let skipped = 0;
  const topicCodes = new Set(
    chapters.flatMap((c) => c.topics.map((t) => t.id))
  );
  const chapterTopicKeys = new Set(
    chapters.flatMap((c) => c.topics.map((t) => `${c.number}:${t.id}`))
  );

  for (const q of questionsFile.questions || []) {
    const text = resolveQuestionText(q);
    const hasTopic =
      chapterTopicKeys.has(`${q.chapter}:${q.topic_id}`) ||
      topicCodes.has(q.topic_id);
    if (!hasTopic || !text) {
      skipped += 1;
      continue;
    }
    const type = mapType(q.type);
    if (type === "MCQ" && !normalizeMcqOk(q)) {
      skipped += 1;
      continue;
    }
    typeCounts[type] += 1;
    importable += 1;
  }

  return {
    slug: slugKey(syllabus.slug || subjectSlug),
    name: syllabus.subject,
    folder: subjectSlug,
    chapters,
    sourceTotal: (questionsFile.questions || []).length,
    importable,
    skipped,
    typeCounts,
    typesPresent: ALL_TYPES.filter((t) => typeCounts[t] > 0),
  };
}

function diffNames(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  return {
    onlyA: [...sa].filter((x) => !sb.has(x)).sort(),
    onlyB: [...sb].filter((x) => !sa.has(x)).sort(),
  };
}

async function loadMongoTree() {
  const board = await GenBoard.findOne({ name: "PTB" }).lean();
  if (!board) return null;

  const tree = {};
  for (const meta of Object.values(CLASS_FOLDERS)) {
    const klass = await GenClass.findOne({
      board: board._id,
      name: meta.name,
    }).lean();
    if (!klass) {
      tree[meta.name] = { subjects: [] };
      continue;
    }
    const subjects = await GenSubject.find({ class: klass._id })
      .sort({ name: 1 })
      .lean();
    const subjectNodes = [];
    for (const sub of subjects) {
      const chapters = await GenChapter.find({ subject: sub._id })
        .sort({ order: 1 })
        .lean();
      const chapterIds = chapters.map((c) => c._id);
      const topics = await GenTopic.find({ chapter: { $in: chapterIds } })
        .sort({ order: 1 })
        .lean();
      const topicsByChapter = new Map();
      for (const t of topics) {
        const key = String(t.chapter);
        const list = topicsByChapter.get(key) || [];
        list.push(t);
        topicsByChapter.set(key, list);
      }

      const counts = await GenQuestion.aggregate([
        { $match: { subject: sub._id, isActive: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]);
      const typeCounts = { MCQ: 0, SHORT: 0, LONG: 0 };
      for (const row of counts) {
        if (typeCounts[row._id] !== undefined) typeCounts[row._id] = row.count;
      }

      subjectNodes.push({
        id: String(sub._id),
        name: sub.name,
        slug: sub.slug,
        chapters: chapters.map((ch) => ({
          name: ch.name,
          topics: (topicsByChapter.get(String(ch._id)) || []).map((t) => ({
            name: t.name,
            code: t.code,
          })),
        })),
        typeCounts,
        totalQuestions:
          typeCounts.MCQ + typeCounts.SHORT + typeCounts.LONG,
        typesPresent: ALL_TYPES.filter((t) => typeCounts[t] > 0),
      });
    }
    tree[meta.name] = { subjects: subjectNodes };
  }
  return tree;
}

async function main() {
  if (!fs.existsSync(DATA_ROOT)) {
    throw new Error(`Data root missing: ${DATA_ROOT}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const mongoTree = await loadMongoTree();
  if (!mongoTree) {
    console.log("FAIL: PTB board not found in Mongo");
    process.exitCode = 1;
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    classes: {},
    summary: {
      subjectsMatch: true,
      chaptersMatch: true,
      topicsMatch: true,
      typesMatch: true,
      countsMatch: true,
      subjectMismatches: [],
      chapterMismatches: [],
      topicMismatches: [],
      typeMismatches: [],
      countMismatches: [],
    },
  };

  console.log("=== PTB verify: PTS seed JSON vs Mongo Gen* ===\n");

  for (const [folder, meta] of Object.entries(CLASS_FOLDERS)) {
    const sourceSlugs = listSourceSubjects(folder);
    const sourceSubjects = sourceSlugs.map((slug) =>
      loadSourceSubject(folder, slug)
    );
    const mongoClass = mongoTree[meta.name] || { subjects: [] };
    const mongoBySlug = new Map(
      mongoClass.subjects.map((s) => [slugKey(s.slug), s])
    );
    const mongoByName = new Map(
      mongoClass.subjects.map((s) => [s.name.trim().toLowerCase(), s])
    );

    const srcNames = sourceSubjects.map((s) => s.name).sort();
    const mongoNames = mongoClass.subjects.map((s) => s.name).sort();
    const nameDiff = diffNames(
      srcNames.map((n) => n.toLowerCase()),
      mongoNames.map((n) => n.toLowerCase())
    );

    console.log(`── ${meta.name} ──`);
    console.log(
      `  Subjects: SRC ${sourceSubjects.length} | Mongo ${mongoClass.subjects.length}`
    );

    const classReport = {
      subjectCount: {
        source: sourceSubjects.length,
        mongo: mongoClass.subjects.length,
        match: sourceSubjects.length === mongoClass.subjects.length,
      },
      subjectsOnlyInSource: nameDiff.onlyA,
      subjectsOnlyInMongo: nameDiff.onlyB,
      subjects: [],
    };

    if (nameDiff.onlyA.length || nameDiff.onlyB.length) {
      report.summary.subjectsMatch = false;
      report.summary.subjectMismatches.push({
        class: meta.name,
        onlySource: nameDiff.onlyA,
        onlyMongo: nameDiff.onlyB,
      });
      console.log(`  !! Subject name mismatch`);
      if (nameDiff.onlyA.length)
        console.log(`     only SRC: ${nameDiff.onlyA.join(", ")}`);
      if (nameDiff.onlyB.length)
        console.log(`     only Mongo: ${nameDiff.onlyB.join(", ")}`);
    } else {
      console.log(`  ✓ Subject list match (${srcNames.join(", ")})`);
    }

    for (const src of sourceSubjects) {
      const mongo =
        mongoBySlug.get(src.slug) ||
        mongoByName.get(src.name.trim().toLowerCase());

      const row = {
        name: src.name,
        slug: src.slug,
        foundInMongo: Boolean(mongo),
        chapters: { source: src.chapters.length, mongo: 0, match: false },
        topics: { source: 0, mongo: 0, match: false },
        types: { source: src.typesPresent, mongo: [], match: false },
        counts: {
          source: src.typeCounts,
          mongo: { MCQ: 0, SHORT: 0, LONG: 0 },
          importable: src.importable,
          sourceFileTotal: src.sourceTotal,
          skippedOnImportRules: src.skipped,
          match: false,
        },
        chapterNameDiff: null,
        topicIssues: [],
      };

      if (!mongo) {
        report.summary.subjectsMatch = false;
        report.summary.subjectMismatches.push({
          class: meta.name,
          missingInMongo: src.name,
        });
        console.log(`  ✗ MISSING in Mongo: ${src.name}`);
        classReport.subjects.push(row);
        continue;
      }

      row.chapters.mongo = mongo.chapters.length;
      row.chapters.match = src.chapters.length === mongo.chapters.length;

      const srcChapterNames = src.chapters.map((c) => c.name);
      const mongoChapterNames = mongo.chapters.map((c) => c.name);
      const chDiff = diffNames(srcChapterNames, mongoChapterNames);
      row.chapterNameDiff = chDiff;

      if (chDiff.onlyA.length || chDiff.onlyB.length || !row.chapters.match) {
        report.summary.chaptersMatch = false;
        report.summary.chapterMismatches.push({
          class: meta.name,
          subject: src.name,
          sourceCount: src.chapters.length,
          mongoCount: mongo.chapters.length,
          onlySource: chDiff.onlyA,
          onlyMongo: chDiff.onlyB,
        });
        console.log(
          `  ✗ ${src.name}: chapters SRC ${src.chapters.length} vs Mongo ${mongo.chapters.length}`
        );
      }

      const srcTopics = src.chapters.flatMap((c) =>
        c.topics.map((t) => `${c.name}::${t.name}`)
      );
      const mongoTopics = mongo.chapters.flatMap((c) =>
        c.topics.map((t) => `${c.name}::${t.name}`)
      );
      row.topics.source = srcTopics.length;
      row.topics.mongo = mongoTopics.length;
      row.topics.match = srcTopics.length === mongoTopics.length;
      const tDiff = diffNames(srcTopics, mongoTopics);
      if (tDiff.onlyA.length || tDiff.onlyB.length || !row.topics.match) {
        report.summary.topicsMatch = false;
        const sampleOnlySrc = tDiff.onlyA.slice(0, 5);
        const sampleOnlyMongo = tDiff.onlyB.slice(0, 5);
        report.summary.topicMismatches.push({
          class: meta.name,
          subject: src.name,
          sourceCount: srcTopics.length,
          mongoCount: mongoTopics.length,
          onlySourceSample: sampleOnlySrc,
          onlyMongoSample: sampleOnlyMongo,
          onlySourceCount: tDiff.onlyA.length,
          onlyMongoCount: tDiff.onlyB.length,
        });
        row.topicIssues = {
          onlySourceCount: tDiff.onlyA.length,
          onlyMongoCount: tDiff.onlyB.length,
        };
        console.log(
          `  ✗ ${src.name}: topics SRC ${srcTopics.length} vs Mongo ${mongoTopics.length} (Δsrc ${tDiff.onlyA.length}, Δmongo ${tDiff.onlyB.length})`
        );
      }

      row.types.mongo = mongo.typesPresent;
      row.types.match =
        src.typesPresent.length === mongo.typesPresent.length &&
        src.typesPresent.every((t) => mongo.typesPresent.includes(t));
      if (!row.types.match) {
        report.summary.typesMatch = false;
        report.summary.typeMismatches.push({
          class: meta.name,
          subject: src.name,
          source: src.typesPresent,
          mongo: mongo.typesPresent,
        });
        console.log(
          `  ✗ ${src.name}: types SRC [${src.typesPresent}] vs Mongo [${mongo.typesPresent}]`
        );
      }

      row.counts.mongo = mongo.typeCounts;
      // Compare Mongo vs importable source (same rules as importer)
      const countsEqual =
        mongo.typeCounts.MCQ === src.typeCounts.MCQ &&
        mongo.typeCounts.SHORT === src.typeCounts.SHORT &&
        mongo.typeCounts.LONG === src.typeCounts.LONG;
      row.counts.match = countsEqual;
      if (!countsEqual) {
        report.summary.countsMatch = false;
        report.summary.countMismatches.push({
          class: meta.name,
          subject: src.name,
          sourceImportable: src.typeCounts,
          mongo: mongo.typeCounts,
          delta: {
            MCQ: mongo.typeCounts.MCQ - src.typeCounts.MCQ,
            SHORT: mongo.typeCounts.SHORT - src.typeCounts.SHORT,
            LONG: mongo.typeCounts.LONG - src.typeCounts.LONG,
          },
          sourceFileTotal: src.sourceTotal,
          skippedOnImportRules: src.skipped,
        });
        console.log(
          `  ✗ ${src.name}: counts SRC(importable) MCQ/S/L ${src.typeCounts.MCQ}/${src.typeCounts.SHORT}/${src.typeCounts.LONG} vs Mongo ${mongo.typeCounts.MCQ}/${mongo.typeCounts.SHORT}/${mongo.typeCounts.LONG} (file ${src.sourceTotal}, skip-rules ${src.skipped})`
        );
      } else if (
        row.chapters.match &&
        !chDiff.onlyA.length &&
        !chDiff.onlyB.length &&
        row.topics.match &&
        row.types.match
      ) {
        console.log(
          `  ✓ ${src.name}: ch ${src.chapters.length}, topics ${srcTopics.length}, types [${src.typesPresent.join(",")}], Q ${src.typeCounts.MCQ}/${src.typeCounts.SHORT}/${src.typeCounts.LONG}`
        );
      } else {
        console.log(
          `  ~ ${src.name}: counts OK (${src.typeCounts.MCQ}/${src.typeCounts.SHORT}/${src.typeCounts.LONG}) but structure issues above`
        );
      }

      classReport.subjects.push(row);
    }

    // Mongo subjects with no source counterpart
    for (const m of mongoClass.subjects) {
      const matched = sourceSubjects.some(
        (s) =>
          s.slug === slugKey(m.slug) ||
          s.name.trim().toLowerCase() === m.name.trim().toLowerCase()
      );
      if (!matched) {
        console.log(`  ✗ EXTRA in Mongo (no seed folder): ${m.name}`);
      }
    }

    report.classes[meta.name] = classReport;
    console.log("");
  }

  const outPath = path.join(DATA_ROOT, "_verify-ptb-vs-mongo.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("═══ SUMMARY ═══");
  console.log(
    `Subjects: ${report.summary.subjectsMatch ? "MATCH" : "MISMATCH"}`
  );
  console.log(
    `Chapters: ${report.summary.chaptersMatch ? "MATCH" : "MISMATCH"}`
  );
  console.log(`Topics:   ${report.summary.topicsMatch ? "MATCH" : "MISMATCH"}`);
  console.log(`Types:    ${report.summary.typesMatch ? "MATCH" : "MISMATCH"}`);
  console.log(
    `Counts:   ${report.summary.countsMatch ? "MATCH" : "MISMATCH"}`
  );
  console.log(`\nFull report: ${outPath}`);
  console.log(
    `Subject mismatches: ${report.summary.subjectMismatches.length}`
  );
  console.log(
    `Chapter mismatches: ${report.summary.chapterMismatches.length}`
  );
  console.log(`Topic mismatches: ${report.summary.topicMismatches.length}`);
  console.log(`Type mismatches: ${report.summary.typeMismatches.length}`);
  console.log(`Count mismatches: ${report.summary.countMismatches.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
