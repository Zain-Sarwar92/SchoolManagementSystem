/**
 * Fix Class 9 اُردو لازمی bank: remap PTS subtype IDs → correct Matric fields.
 * Prior seed stored 19/28/30/48 as SHORT:QA instead of POEM/SUMMARY/CENTRAL/PASSAGE.
 *
 * Usage: node src/scripts/fixUrdu9MatricFields.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import GenSubject from "../models/generator/GenSubject.js";
import GenClass from "../models/generator/GenClass.js";
import GenQuestion from "../models/generator/GenQuestion.js";
import { URDU_MATRIC_SUBTYPES } from "../constants/ptsQuestionSubTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(
  __dirname,
  "../../data/pts-live/PTB/9/ا-ردو-لازمی"
);

const SOURCE_BY_FIELD = {
  SUMMARY: "Summary",
  PASSAGE: "Passage",
  POEM: "Poem Stanzas",
  CENTRAL: "Central idea",
  QA: "Exercise",
  MCQ: "Exercise",
  CORRECT: "Sentence correction",
  IDIOM: "Idioms",
  LETTER: "Letters",
  APPLICATION: "Application",
  STORY: "Stories",
  DIALOGUE: "Dialogues",
  MEANING: "Correct meaning of underlined word",
};

function marksFor(bankType) {
  if (bankType === "long" || bankType === "LONG") return 5;
  if (bankType === "mcq" || bankType === "MCQ") return 1;
  return 2;
}

function resolveMeta(subTypeId) {
  const meta = URDU_MATRIC_SUBTYPES[Number(subTypeId)];
  if (!meta) return null;
  return {
    field: meta.field,
    bankType: meta.bankType,
    typeUpper: meta.bankType === "mcq" ? "MCQ" : meta.bankType === "long" ? "LONG" : "SHORT",
  };
}

function fixJsonFile() {
  const qPath = path.join(DATA_DIR, "all-questions.json");
  const hPath = path.join(DATA_DIR, "pts-raw/hierarchy.json");
  const data = JSON.parse(fs.readFileSync(qPath, "utf8"));
  const list = data.questions || [];
  let changed = 0;
  const typeTotals = {};

  for (const q of list) {
    const meta = resolveMeta(q.subTypeId);
    if (!meta) continue;
    const nextType = meta.bankType;
    const nextField = meta.field;
    if (q.type !== nextType || q.field !== nextField) {
      q.type = nextType;
      q.field = nextField;
      q.source = SOURCE_BY_FIELD[nextField] || q.source || q.priority || nextField;
      changed += 1;
    } else if (!q.source || q.source === "Additional") {
      const prefer = SOURCE_BY_FIELD[nextField];
      if (prefer) q.source = prefer;
    }
    typeTotals[nextField] = (typeTotals[nextField] || 0) + 1;
  }

  const types = Object.entries(URDU_MATRIC_SUBTYPES)
    .filter(([id]) => list.some((q) => Number(q.subTypeId) === Number(id)))
    .map(([id, meta]) => ({
      id: Number(id),
      name: meta.name,
      bankType: meta.bankType,
      field: meta.field,
    }));

  data.types = types;
  data.typeTotals = typeTotals;
  data.counts = {
    mcq: list.filter((q) => q.type === "mcq").length,
    short: list.filter((q) => q.type === "short").length,
    long: list.filter((q) => q.type === "long").length,
  };
  data.total_questions = list.length;
  data.fixedAt = new Date().toISOString();
  data.fixNote =
    "Remapped Urdu Matric subtype IDs via URDU_MATRIC_SUBTYPES (19=POEM, 28=SUMMARY, 30=CENTRAL, 48=PASSAGE).";

  fs.writeFileSync(qPath, JSON.stringify(data, null, 2));
  console.log(`JSON: updated ${changed}/${list.length} questions`);
  console.log("typeTotals", typeTotals);

  if (fs.existsSync(hPath)) {
    const hierarchy = JSON.parse(fs.readFileSync(hPath, "utf8"));
    hierarchy.exportTypes = types;
    fs.writeFileSync(hPath, JSON.stringify(hierarchy, null, 2));
    console.log("hierarchy.exportTypes updated");
  }

  return { list, typeTotals, types };
}

async function fixMongo() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const klass = await GenClass.findOne({ name: /9TH|9/i });
  if (!klass) throw new Error("Class 9TH not found");

  const subject = await GenSubject.findOne({
    class: klass._id,
    name: /اردو|اُردو|urdu/i,
  });
  if (!subject) throw new Error("اُردو لازمی subject not found");

  const cursor = GenQuestion.find({ subject: subject._id }).cursor();
  let updated = 0;
  let scanned = 0;
  const tallies = {};

  for await (const doc of cursor) {
    scanned += 1;
    const key = String(doc.externalKey || "");
    /* pts:9:50:{subTypeId}:{questionId} */
    const m = key.match(/^pts:\d+:\d+:(\d+):\d+$/);
    if (!m) continue;
    const meta = resolveMeta(m[1]);
    if (!meta) continue;

    const next = {
      type: meta.typeUpper,
      subType: meta.field,
      marks: marksFor(meta.bankType),
    };
    if (SOURCE_BY_FIELD[meta.field]) next.source = SOURCE_BY_FIELD[meta.field];

    const dirty =
      doc.type !== next.type ||
      doc.subType !== next.subType ||
      Number(doc.marks) !== next.marks ||
      (next.source && doc.source !== next.source);

    if (dirty) {
      await GenQuestion.updateOne({ _id: doc._id }, { $set: next });
      updated += 1;
    }
    tallies[`${next.type}:${next.subType}`] =
      (tallies[`${next.type}:${next.subType}`] || 0) + 1;
  }

  console.log(`Mongo subject=${subject.name} scanned=${scanned} updated=${updated}`);
  console.log("mongo tallies", tallies);

  /* Chapter 1 sanity check */
  const ch1Topic = await mongoose.connection.collection("gentopics").findOne({
    name: /اخلاق حسنہ/,
  });
  if (ch1Topic) {
    const ch1 = await GenQuestion.aggregate([
      { $match: { topic: ch1Topic._id } },
      {
        $group: {
          _id: { type: "$type", subType: "$subType" },
          n: { $sum: 1 },
        },
      },
      { $sort: { "_id.type": 1, "_id.subType": 1 } },
    ]);
    console.log("chapter اخلاق حسنہ types:", ch1);
  }

  await mongoose.disconnect();
}

const { typeTotals } = fixJsonFile();
await fixMongo();

fs.writeFileSync(
  path.join(DATA_DIR, "_seed-result.json"),
  JSON.stringify(
    {
      slug: "ا-ردو-لازمی",
      name: "اُردو لازمی",
      fixedAt: new Date().toISOString(),
      typeTotals,
      note: "Fixed Matric Urdu field mapping from existing PTS export",
    },
    null,
    2
  )
);

console.log("Done.");
