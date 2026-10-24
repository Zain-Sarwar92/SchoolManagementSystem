/**
 * Seed 30 dummy Test Generator papers for Saved Papers UI testing.
 *
 * Usage: node src/scripts/seedDummyGeneratorPapers.js
 * Optional: COUNT=32 node src/scripts/seedDummyGeneratorPapers.js
 * Optional: EMAIL=admin@example.com node src/scripts/seedDummyGeneratorPapers.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Academy from "../models/Academy.js";
import User from "../models/User.js";
import GeneratorPaper from "../models/GeneratorPaper.js";
import GenQuestion from "../models/generator/GenQuestion.js";
import GenSubject from "../models/generator/GenSubject.js";

const COUNT = Math.min(
  40,
  Math.max(25, Number(process.env.COUNT) || 30)
);

const CLASSES = ["9TH", "10TH", "11TH", "INTER-I", "INTER-II"];
const SUBJECTS = [
  "Mathematics",
  "Biology",
  "Physics",
  "Chemistry",
  "Computer",
  "English",
  "اردو لازمی",
  "Islamiyat",
];
const CATEGORIES = [
  "Monthly Test",
  "Chapter Test",
  "Mid Term",
  "Send-up",
  "Final Term",
  "Practice Test",
  "RTS",
  "BD7",
  "PK D6",
];
const MEDIUMS = ["english", "urdu", "dual"];
const BOARDS = ["Punjab Textbook", "Lahore Board", "Federal Board"];

const FALLBACK_MCQ = [
  {
    text: "What is the basic unit of digital systems?",
    textUrdu: "ڈیجیٹل سسٹمز کی بنیادی اکائی کیا ہے؟",
    optionA: "Bit / بٹ",
    optionB: "Byte / بائٹ",
    optionC: "Word / ورڈ",
    optionD: "Nibble / نبل",
    correctAnswer: "A",
  },
  {
    text: "Which gate gives high output only when all inputs are high?",
    textUrdu: "کون سا گیٹ صرف تمام ان پٹ ہائی ہونے پر ہائی آؤٹ پٹ دیتا ہے؟",
    optionA: "OR / یا",
    optionB: "AND / اور",
    optionC: "NOT / نہیں",
    optionD: "XOR / ایکس او آر",
    correctAnswer: "B",
  },
  {
    text: "DAC stands for:",
    textUrdu: "DAC کا مطلب ہے:",
    optionA: "Digital to Analog Converter",
    optionB: "Data Access Control",
    optionC: "Direct Analog Circuit",
    optionD: "Digital Application Code",
    correctAnswer: "A",
  },
];

const FALLBACK_SHORT = [
  {
    text: "Define a bit.",
    textUrdu: "بٹ کی تعریف کریں۔",
  },
  {
    text: "What is Boolean algebra?",
    textUrdu: "بولین الجبرا کیا ہے؟",
  },
  {
    text: "Write any two uses of a computer.",
    textUrdu: "کمپیوٹر کے کوئی دو استعمال لکھیں۔",
  },
];

const FALLBACK_LONG = [
  {
    text: "Explain the difference between analog and digital signals.",
    textUrdu: "اینالاگ اور ڈیجیٹل سگنلز میں فرق بیان کریں۔",
  },
  {
    text: "Describe the working of an AND gate with truth table.",
    textUrdu: "AND گیٹ کا طریقہ کار سچائی جدول کے ساتھ بیان کریں۔",
  },
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 8), (n * 7) % 60, 0, 0);
  return d;
}

function mapDbQuestion(q, type, marks, order) {
  return {
    question: q._id,
    type,
    text: q.text || q.stem || "Question",
    textUrdu: q.textUrdu || q.stemUrdu || null,
    optionA: q.optionA || null,
    optionB: q.optionB || null,
    optionC: q.optionC || null,
    optionD: q.optionD || null,
    correctAnswer: q.correctAnswer || null,
    marks,
    order,
  };
}

function mapFallback(item, type, marks, order) {
  return {
    question: null,
    type,
    text: item.text,
    textUrdu: item.textUrdu || null,
    optionA: item.optionA || null,
    optionB: item.optionB || null,
    optionC: item.optionC || null,
    optionD: item.optionD || null,
    correctAnswer: item.correctAnswer || null,
    marks,
    order,
  };
}

function buildSections(i, bank) {
  const mcqCount = 4 + (i % 3);
  const shortCount = 3 + (i % 3);
  const longCount = 1 + (i % 2);
  const mcqMarks = 1;
  const shortMarks = 2;
  const longMarks = 5;

  const mcqQs = [];
  for (let k = 0; k < mcqCount; k++) {
    const src = bank.mcq[k % Math.max(bank.mcq.length, 1)];
    mcqQs.push(
      src?._id
        ? mapDbQuestion(src, "MCQ", mcqMarks, k)
        : mapFallback(pick(FALLBACK_MCQ, i + k), "MCQ", mcqMarks, k)
    );
  }

  const shortQs = [];
  for (let k = 0; k < shortCount; k++) {
    const src = bank.short[k % Math.max(bank.short.length, 1)];
    shortQs.push(
      src?._id
        ? mapDbQuestion(src, "SHORT", shortMarks, k)
        : mapFallback(pick(FALLBACK_SHORT, i + k), "SHORT", shortMarks, k)
    );
  }

  const longQs = [];
  for (let k = 0; k < longCount; k++) {
    const src = bank.long[k % Math.max(bank.long.length, 1)];
    longQs.push(
      src?._id
        ? mapDbQuestion(src, "LONG", longMarks, k)
        : mapFallback(pick(FALLBACK_LONG, i + k), "LONG", longMarks, k)
    );
  }

  const sections = [
    { type: "MCQ", attemptCount: 0, marksEach: mcqMarks, questions: mcqQs },
    {
      type: "SHORT",
      attemptCount: shortCount > 3 ? shortCount - 1 : 0,
      marksEach: shortMarks,
      questions: shortQs,
    },
    { type: "LONG", attemptCount: 0, marksEach: longMarks, questions: longQs },
  ];

  const totalMarks = sections.reduce(
    (sum, s) => sum + s.questions.length * s.marksEach,
    0
  );

  return { sections, totalMarks };
}

async function loadBank() {
  const [mcq, short, long] = await Promise.all([
    GenQuestion.find({ type: "MCQ" }).limit(40).lean(),
    GenQuestion.find({ type: "SHORT" }).limit(40).lean(),
    GenQuestion.find({ type: "LONG" }).limit(20).lean(),
  ]);
  return {
    mcq: mcq.length ? mcq : FALLBACK_MCQ,
    short: short.length ? short : FALLBACK_SHORT,
    long: long.length ? long : FALLBACK_LONG,
  };
}

async function resolveTenant() {
  const email = String(process.env.EMAIL || "").trim().toLowerCase();
  if (email) {
    const user = await User.findOne({ email, role: "academy_admin" });
    if (!user?.academy) {
      throw new Error(`No academy_admin found for EMAIL=${email}`);
    }
    const academy = await Academy.findById(user.academy);
    return { academy, user };
  }

  let academy = await Academy.findOne({
    moduleTestGenerator: true,
    status: "active",
  }).sort({ createdAt: 1 });

  if (!academy) {
    academy = await Academy.findOne({}).sort({ createdAt: 1 });
  }
  if (!academy) throw new Error("No academy found in database");

  let user = await User.findOne({
    academy: academy._id,
    role: "academy_admin",
    isActive: true,
  });
  if (!user) {
    user = await User.findOne({ role: "academy_admin" });
  }
  if (!user) throw new Error("No academy_admin user found");

  return { academy, user };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");

  await mongoose.connect(uri);
  console.log("Connected");

  const { academy, user } = await resolveTenant();
  console.log("Academy:", academy.name, academy._id.toString());
  console.log("User:", user.name, user.email);

  const bank = await loadBank();
  const subjects = await GenSubject.find({}).limit(20).lean();

  const docs = [];
  for (let i = 0; i < COUNT; i++) {
    const classLabel = pick(CLASSES, i);
    const subjectLabel = pick(SUBJECTS, i + 2);
    const category = pick(CATEGORIES, i);
    const medium = pick(MEDIUMS, i);
    const boardLabel = pick(BOARDS, i);
    const matchedSubject =
      subjects.find((s) =>
        String(s.name || "")
          .toLowerCase()
          .includes(String(subjectLabel).toLowerCase().slice(0, 4))
      ) || null;

    const { sections, totalMarks } = buildSections(i, bank);
    const createdAt = daysAgo(COUNT - i);
    const examDate = daysAgo(Math.max(0, COUNT - i - 5));

    docs.push({
      academy: academy._id,
      createdBy: user._id,
      title: `${category.split(" ")[0]}${i + 1} ${subjectLabel} ${classLabel}`,
      boardLabel,
      classLabel,
      subjectLabel,
      subject: matchedSubject?._id || null,
      medium,
      distributionMode: i % 4 === 0 ? "RANDOM" : "BALANCED",
      totalMarks,
      durationMinutes: 45 + (i % 4) * 15,
      examDate,
      instructions: "Attempt all questions. Use fair means.",
      syllabusNote: `Ch ${(i % 6) + 1}–${(i % 6) + 2}`,
      paperCategory: category,
      sections,
      status: "saved",
      createdAt,
      updatedAt: createdAt,
    });
  }

  const result = await GeneratorPaper.insertMany(docs, { ordered: true });
  console.log(`\nInserted ${result.length} dummy papers.`);
  console.log("Open Saved Papers to see them.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
