/**
 * Live PTS → Mongo full sync for Class 12 / INTER-II پنجابی.
 * Inter subtypes (SUMMARY=29, VITAL=33, PASSAGE=49) + replace bank.
 *
 *   node src/scripts/syncPunjabi12Live.js
 *   node src/scripts/syncPunjabi12Live.js --from-dump
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
import { resolvePtsSubType } from "../constants/ptsQuestionSubTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.paktestsolution.com";
const CLASS_ID = 12;
const SUBJECT_ID = 132;
const SUBJECT_NAME = "پنجابی";
const CLASS_NAME = "12TH";
/* PTS UI: Exercise=1, Past Papers=2, Additional=3 */
const PRIORITIES = [1, 2, 3, 4, 5, 7];
const TOPIC_CHUNK = 4;
const OUT_DIR = path.resolve(__dirname, "../../data/pts-live/PTB/12/punjabi");
const LAHORE_DIR = path.resolve(__dirname, "../../data/lahore-board/12th/punjabi");

const SYNC_TYPE_IDS = [1, 14, 19, 29, 33, 49];
const SYNC_TYPES = SYNC_TYPE_IDS.map((id) =>
  resolvePtsSubType(SUBJECT_NAME, id, CLASS_NAME)
);

const KEEP = new Set([
  "img",
  "br",
  "sub",
  "sup",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "u",
]);

const jar = new Map();

function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function req(url, tries = 5) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
  };
  const cookie =
    process.env.PTS_COOKIE?.trim() ||
    [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.Cookie = cookie;
  let lastErr;
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(url, { headers, redirect: "manual" });
      store(res);
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 900 * a));
    }
  }
  throw lastErr || new Error("fetch failed");
}

async function login() {
  if (process.env.PTS_COOKIE?.trim()) {
    await req(`${BASE}/GeneratePaper/GetSyllabus`);
    console.log("Using PTS_COOKIE");
    return;
  }
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", process.env.PTS_USER);
  u.searchParams.set("password", process.env.PTS_PASS);
  const login = await (await req(u.toString())).json();
  if (!login.IsValid) throw new Error(`Login failed: ${login.html}`);
  await req(`${BASE}${login.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in to PTS");
}

async function getQuestions(topicIds, subTypeId, priorityId) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  const j = JSON.parse(await (await req(u.toString())).text());
  return j.QuestionsList || [];
}

function preservePtsHtml(html) {
  if (!html) return "";
  let s = String(html);
  s = s.replace(
    /<span\b([^>]*?)\bstyle\s*=\s*(["'])([^"']*text-decoration\s*:\s*underline[^"']*)\2([^>]*)>([\s\S]*?)<\/span>/gi,
    "<u>$5</u>"
  );
  s = s
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br /><br />")
    .replace(/<p\b[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<\/div>\s*<div\b[^>]*>/gi, "<br /><br />")
    .replace(/<div\b[^>]*>/gi, "")
    .replace(/<\/div>/gi, "");
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs = "") => {
    const name = String(tag).toLowerCase();
    const closing = full.startsWith("</");
    if (!KEEP.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br />";
    if (name === "img") {
      const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
      let src = (srcMatch?.[2] || "").trim().replace(/\\/g, "/");
      if (!src) return "";
      if (src.startsWith("//")) src = `https:${src}`;
      return `<img src="${src.replace(/"/g, "&quot;")}" alt="" />`;
    }
    return `<${name}>`;
  });
  return s
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n/g, "\n")
    .trim();
}

function optionText(opt = {}) {
  const en = preservePtsHtml(opt.EmOption || "");
  const ur = preservePtsHtml(opt.UmOption || "");
  if (en && ur && en !== ur) return `${en} / ${ur}`;
  return en || ur || "";
}

function correctLetter(opts = []) {
  const sorted = opts.slice().sort((a, b) => a.OptionID - b.OptionID);
  const idx = sorted.findIndex((o) => o.Answer);
  return idx >= 0 ? "ABCD"[idx] : null;
}

function typeUpper(bankType) {
  if (bankType === "mcq") return "MCQ";
  if (bankType === "long") return "LONG";
  return "SHORT";
}

function marksFor(bankType) {
  if (bankType === "mcq") return 1;
  if (bankType === "long") return 5;
  return 2;
}

async function main() {
  const fromDump = process.argv.includes("--from-dump");
  let fetched = [];
  let typeTotals = {};
  let syllabus;

  if (fromDump) {
    const dump = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "all-questions.json"), "utf8")
    );
    syllabus = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "syllabus.json"), "utf8")
    );
    fetched = dump.questions || [];
    typeTotals = dump.typeTotals || {};
    console.log(`From dump: ${fetched.length} questions`, typeTotals);
  } else {
    await login();

    const hier = await (
      await req(
        `${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${SUBJECT_ID}`
      )
    ).json();
    const chaptersPts = hier.ChaptersList || [];
    const topicsPts = hier.TopicsList || [];
    console.log(
      `PTS chapters=${chaptersPts.length} topics=${topicsPts.length}`
    );

    /* Sequential order — باب/نظم/غزل numbers would collide if parsed from title. */
    const chapterOrder = new Map();
    chaptersPts.forEach((ch, i) => {
      chapterOrder.set(ch.ChapterID, {
        number: i + 1,
        title: ch.ChapterName,
        ptsId: ch.ChapterID,
      });
    });

    const topicMeta = new Map();
    const topicsByChapter = new Map();
    for (const t of topicsPts) {
      const ch = chapterOrder.get(t.ChapterID) || {
        number: 0,
        title: "?",
        ptsId: t.ChapterID,
      };
      const code =
        String(t.TopicRef || "").match(/^\d+(\.\d+)*$/)
          ? String(t.TopicRef)
          : `${ch.number}.${(topicsByChapter.get(ch.number)?.length || 0) + 1}`;
      const row = {
        topicId: t.TopicID,
        code,
        title: t.TopicName,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterPtsId: t.ChapterID,
      };
      topicMeta.set(t.TopicID, row);
      if (!topicsByChapter.has(ch.number)) topicsByChapter.set(ch.number, []);
      topicsByChapter.get(ch.number).push(row);
    }

    for (const type of SYNC_TYPES) {
      const seen = new Map();
      for (const pri of PRIORITIES) {
        for (let i = 0; i < topicsPts.length; i += TOPIC_CHUNK) {
          const chunk = topicsPts.slice(i, i + TOPIC_CHUNK);
          let list = [];
          try {
            list = await getQuestions(
              chunk.map((t) => t.TopicID).join(","),
              type.id,
              pri
            );
          } catch (e) {
            console.warn(`fetch fail ${type.field} pri=${pri}: ${e.message}`);
          }
          for (const raw of list) {
            if (seen.has(raw.QuestionID)) continue;
            const meta = topicMeta.get(raw.TopicID);
            if (!meta) continue;
            const en = preservePtsHtml(raw.EnglishQuestionDetails);
            const ur = preservePtsHtml(raw.UrduQuestionDetails);
            const text = (en || ur || "").trim();
            if (!text || text === ".") continue;
            const sorted = [...(raw.MultipleOptions || [])].sort(
              (a, b) => a.OptionID - b.OptionID
            );
            const item = {
              id: raw.QuestionID,
              subTypeId: type.id,
              chapter: meta.chapterNumber,
              topic_id: meta.code,
              topicPtsId: raw.TopicID,
              type: type.bankType,
              field: type.field,
              source: raw.QuestionPeriority || type.name,
              en: en || ur,
              ur: ur && ur !== en ? ur : undefined,
            };
            if (type.bankType === "mcq") {
              item.optionA = optionText(sorted[0] || {});
              item.optionB = optionText(sorted[1] || {});
              item.optionC = optionText(sorted[2] || {});
              item.optionD = optionText(sorted[3] || {});
              item.correctAnswer = correctLetter(sorted) || undefined;
              if (!item.correctAnswer) continue;
              const present = [
                item.optionA,
                item.optionB,
                item.optionC,
                item.optionD,
              ].filter((v) => String(v || "").trim()).length;
              if (present < 2) continue;
            }
            seen.set(raw.QuestionID, item);
          }
        }
      }
      typeTotals[type.field] = seen.size;
      console.log(`  ${type.field} (${type.id}): ${seen.size}`);
      fetched.push(...seen.values());
    }

    console.log("typeTotals", typeTotals, "total", fetched.length);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    syllabus = {
      board: "PTB",
      class: "12",
      subject: SUBJECT_NAME,
      slug: "punjabi",
      chapters: [...topicsByChapter.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, topics]) => ({
          number,
          title: topics[0]?.chapterTitle || `Chapter ${number}`,
          topics: topics.map((t) => ({ id: t.code, title: t.title })),
        })),
    };
    const dump = {
      board: "PTB",
      class: "12",
      subject: SUBJECT_NAME,
      slug: "punjabi",
      types: SYNC_TYPES.map((t) => ({
        id: t.id,
        name: t.name,
        bankType: t.bankType,
        field: t.field,
      })),
      typeTotals,
      total_questions: fetched.length,
      counts: {
        mcq: fetched.filter((q) => q.type === "mcq").length,
        short: fetched.filter((q) => q.type === "short").length,
        long: fetched.filter((q) => q.type === "long").length,
      },
      exportedAt: new Date().toISOString(),
      questions: fetched,
    };
    fs.writeFileSync(
      path.join(OUT_DIR, "all-questions.json"),
      JSON.stringify(dump, null, 2)
    );
    fs.writeFileSync(
      path.join(OUT_DIR, "syllabus.json"),
      JSON.stringify(syllabus, null, 2)
    );
    fs.mkdirSync(LAHORE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(LAHORE_DIR, "all-questions.json"),
      JSON.stringify(dump, null, 2)
    );
    fs.writeFileSync(
      path.join(LAHORE_DIR, "syllabus.json"),
      JSON.stringify({ ...syllabus, board: "Lahore" }, null, 2)
    );
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const board =
    (await GenBoard.findOne({ code: "PTB" })) ||
    (await GenBoard.findOne({ name: /PTB|Punjab/i }));
  if (!board) throw new Error("PTB board not found");

  const klass =
    (await GenClass.findOne({ board: board._id, ptsClassId: CLASS_ID })) ||
    (await GenClass.findOne({ board: board._id, name: /12TH|INTER.?II|^12$/i }));
  if (!klass) throw new Error("Class 12TH not found");

  let subject = await GenSubject.findOne({
    class: klass._id,
    $or: [{ slug: "punjabi" }, { name: /پنجابی|punjabi/i }],
  });
  if (!subject) throw new Error("پنجابی subject not found");

  const existingChapters = await GenChapter.find({
    subject: subject._id,
  }).lean();
  const norm = (s) =>
    String(s || "")
      .replace(/^\s*\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

  const chapterDocs = new Map();
  for (const ch of syllabus.chapters) {
    const wantName = `${ch.number}. ${ch.title}`;
    let doc =
      existingChapters.find((c) => c.name === wantName) ||
      existingChapters.find((c) => c.name === ch.title) ||
      existingChapters.find((c) => norm(c.name) === norm(ch.title)) ||
      existingChapters.find((c) => Number(c.order) === Number(ch.number));

    if (!doc) {
      doc = await GenChapter.create({
        subject: subject._id,
        name: wantName,
        order: ch.number,
      });
      existingChapters.push(doc.toObject ? doc.toObject() : doc);
    } else {
      await GenChapter.updateOne(
        { _id: doc._id },
        { $set: { name: wantName, order: ch.number } }
      );
      doc.name = wantName;
      doc.order = ch.number;
    }
    chapterDocs.set(ch.number, doc);

    for (let ti = 0; ti < ch.topics.length; ti++) {
      const t = ch.topics[ti];
      let topic =
        (await GenTopic.findOne({ chapter: doc._id, code: t.id })) ||
        (await GenTopic.findOne({ chapter: doc._id, name: t.title })) ||
        (await GenTopic.findOne({
          chapter: doc._id,
          name: `${t.id} ${t.title}`,
        }));
      if (!topic) {
        topic = await GenTopic.create({
          chapter: doc._id,
          code: t.id,
          name: t.title,
          order: ti + 1,
        });
      } else {
        await GenTopic.updateOne(
          { _id: topic._id },
          { $set: { code: t.id, name: t.title, order: ti + 1 } }
        );
      }
    }
  }

  for (const ch of syllabus.chapters) {
    const keep = chapterDocs.get(ch.number);
    const dups = existingChapters.filter(
      (c) =>
        String(c._id) !== String(keep._id) &&
        norm(c.name) === norm(ch.title)
    );
    for (const d of dups) {
      await GenTopic.deleteMany({ chapter: d._id });
      await GenChapter.deleteOne({ _id: d._id });
    }
  }

  const topicByCode = new Map();
  for (const [number, chDoc] of chapterDocs) {
    const topics = await GenTopic.find({ chapter: chDoc._id }).lean();
    for (const t of topics) {
      if (t.code) {
        topicByCode.set(String(t.code), t);
        topicByCode.set(`${number}:${t.code}`, t);
      }
      topicByCode.set(`${number}:${t.name}`, t);
    }
  }
  console.log(`topic map keys: ${topicByCode.size}`);

  const keyPrefix = `pts:${CLASS_ID}:${SUBJECT_ID}:`;
  const del = await GenQuestion.deleteMany({ subject: subject._id });
  console.log(`Deleted old questions: ${del.deletedCount}`);

  const payloads = [];
  let skipped = 0;
  for (const q of fetched) {
    const topic =
      topicByCode.get(`${q.chapter}:${q.topic_id}`) ||
      topicByCode.get(q.topic_id);
    if (!topic) {
      skipped += 1;
      continue;
    }
    const type = typeUpper(q.type);
    payloads.push({
      type,
      subType: q.field,
      text: q.en,
      textUrdu: q.ur || null,
      optionA: q.optionA || null,
      optionB: q.optionB || null,
      optionC: q.optionC || null,
      optionD: q.optionD || null,
      correctAnswer: q.correctAnswer || null,
      marks: marksFor(q.type),
      source: q.source || q.field,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey: `${keyPrefix}${q.subTypeId}:${q.id}`,
    });
  }

  let created = 0;
  const CHUNK = 400;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const chunk = payloads.slice(i, i + CHUNK);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
      else if (err?.code === 11000) created += err.result?.nInserted || 0;
      else throw err;
    }
  }

  const bySub = await GenQuestion.aggregate([
    { $match: { subject: subject._id, isActive: true } },
    {
      $group: {
        _id: { type: "$type", subType: "$subType" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.type": 1, "_id.subType": 1 } },
  ]);
  const total = await GenQuestion.countDocuments({
    subject: subject._id,
    isActive: true,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "_seed-result.json"),
    JSON.stringify(
      {
        classId: CLASS_ID,
        subjectId: SUBJECT_ID,
        slug: "punjabi",
        name: SUBJECT_NAME,
        total,
        typeTotals,
        mongo: {
          created,
          skipped,
          typeCounts: Object.fromEntries(
            bySub.map((r) => [`${r._id.type}:${r._id.subType}`, r.count])
          ),
        },
        at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log("\n=== SYSTEM (after sync) ===");
  for (const r of bySub) {
    console.log(`${r._id.type}\t${r._id.subType}\t${r.count}`);
  }
  console.log(`TOTAL\t${total}\tskipped\t${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
