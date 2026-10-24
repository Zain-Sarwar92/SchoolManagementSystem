/**
 * Import PTB Class 9–12 question banks from backend/data/lahore-board
 * into Mongo Gen* collections (Test Generator only — no Academy Management).
 *
 * Usage:
 *   node src/scripts/importPtbBank.js
 *   node src/scripts/importPtbBank.js 9th biology
 *   node src/scripts/importPtbBank.js 9th
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
import { logoForSubjectSlug } from "../constants/ptsSubjectLogos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, "../../data/lahore-board");

const CLASS_FOLDERS = {
  "9th": { grade: 9, name: "9TH", aliases: ["Class 9"] },
  "10th": { grade: 10, name: "10TH", aliases: ["Class 10"] },
  "11th": { grade: 11, name: "INTER-I", aliases: ["Class 11"] },
  "12th": { grade: 12, name: "INTER-II", aliases: ["Class 12"] },
};

const CHUNK = 400;
const BOARD_NAME = "PTB";
const BOARD_ALIASES = ["Punjab Textbook", "PTB"];

function slugKey(slug) {
  return String(slug || "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}

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

async function importSubject(classFolder, subjectSlug) {
  const dataDir = path.join(DATA_ROOT, classFolder, subjectSlug);
  const syllabusPath = path.join(dataDir, "syllabus.json");
  const questionsPath = path.join(dataDir, "all-questions.json");

  if (!fs.existsSync(syllabusPath) || !fs.existsSync(questionsPath)) {
    throw new Error(`Missing syllabus/all-questions in ${dataDir}`);
  }

  const syllabus = JSON.parse(fs.readFileSync(syllabusPath, "utf8"));
  const questionsFile = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
  const meta = CLASS_FOLDERS[classFolder];
  const classKey = String(syllabus.class || meta.grade);
  const subjectName = syllabus.subject;
  const slug = slugKey(syllabus.slug || subjectSlug);
  const keyPrefix = `punjab-textbook:${classKey}:${slug}:`;

  let board = null;
  for (const name of BOARD_ALIASES) {
    board = await GenBoard.findOne({ name });
    if (board) break;
  }
  if (!board) {
    board = await GenBoard.create({
      name: BOARD_NAME,
      code: "PTB",
      subtitle: "Syllabus",
      ptsCourseId: 1,
      sortOrder: 1,
    });
  } else if (board.name !== BOARD_NAME) {
    board.name = BOARD_NAME;
    board.code = board.code || "PTB";
    await board.save();
  }

  const classNames = [meta.name, ...(meta.aliases || [])];
  let klass = null;
  for (const name of classNames) {
    klass = await GenClass.findOne({ board: board._id, name });
    if (klass) break;
  }
  if (!klass) {
    klass = await GenClass.create({
      board: board._id,
      name: meta.name,
      gradeLevel: meta.grade,
    });
  } else if (klass.name !== meta.name) {
    klass.name = meta.name;
    klass.gradeLevel = meta.grade;
    await klass.save();
  }

  const imageUrl = logoForSubjectSlug(slug);
  let subject = await GenSubject.findOne({ class: klass._id, slug });
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
    if (imageUrl && subject.imageUrl !== imageUrl) {
      subject.imageUrl = imageUrl;
      dirty = true;
    }
    if (dirty) await subject.save();
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
    externalKey: { $regex: `^${keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
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

  for (const q of questionsFile.questions || []) {
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

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) {
        created += chunk.length - err.writeErrors.length;
      } else if (err?.code === 11000) {
        // race / duplicate — count non-dup inserts if available
        created += err.result?.nInserted || 0;
      } else {
        throw err;
      }
    }
  }

  return {
    classFolder,
    subject: subjectName,
    slug,
    chapters: (syllabus.chapters || []).length,
    totalSource: (questionsFile.questions || []).length,
    created,
    updated,
    skipped,
    typeCounts,
  };
}

async function main() {
  const onlyClass = process.argv[2] || null;
  const onlySubject = process.argv[3] || null;

  if (!fs.existsSync(DATA_ROOT)) {
    throw new Error(`Data root missing: ${DATA_ROOT}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Importing from", DATA_ROOT);

  const classFolders = Object.keys(CLASS_FOLDERS).filter((folder) =>
    onlyClass ? folder === onlyClass : true
  );

  const results = [];
  for (const classFolder of classFolders) {
    const classDir = path.join(DATA_ROOT, classFolder);
    if (!fs.existsSync(classDir)) {
      console.warn("Skip missing", classFolder);
      continue;
    }
    const subjects = fs
      .readdirSync(classDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => {
        if (onlySubject) return name === onlySubject;
        return (
          fs.existsSync(path.join(classDir, name, "syllabus.json")) &&
          fs.existsSync(path.join(classDir, name, "all-questions.json"))
        );
      });

    for (const slug of subjects) {
      process.stdout.write(`→ ${classFolder}/${slug} ... `);
      const result = await importSubject(classFolder, slug);
      console.log(
        `ok (+${result.created} ~${result.updated} skip ${result.skipped})`
      );
      results.push(result);
    }
  }

  const summaryPath = path.join(DATA_ROOT, "_mongo-import-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  const written = results.reduce((a, r) => a + r.created + r.updated, 0);
  console.log(
    `\nDone: ${results.length} subjects, ${written} questions written`
  );
  console.log("Summary:", summaryPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
