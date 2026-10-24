/**
 * Live PTS → Mongo sync for Class 10 English mismatched types:
 * VERB, DI, ESSAYS, PAIR
 *
 *   node src/scripts/syncEnglish10LiveDiffCli.js
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
const BASE = "https://www.paktestsolution.com";
const REPLACE_FIELDS = ["VERB", "DI", "ESSAYS", "PAIR"];
const TYPES = [
  { id: 5, field: "VERB", bankType: "mcq" },
  { id: 23, field: "DI", bankType: "short" },
  { id: 27, field: "ESSAYS", bankType: "long" },
  { id: 35, field: "PAIR", bankType: "short" },
];
const OUT = path.resolve(
  __dirname,
  "../../data/lahore-board/10th/english/_live-diff-sync.json"
);

const jar = new Map();

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader() {
  if (process.env.PTS_COOKIE?.trim()) return process.env.PTS_COOKIE.trim();
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(url, opts = {}) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    ...(opts.headers || {}),
  };
  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}

async function ptsFetch(urlPath, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await req(`${BASE}${urlPath}`);
      const text = await res.text();
      if (!res.ok) throw new Error(`${urlPath} ${res.status}: ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function login() {
  if (process.env.PTS_COOKIE?.trim()) {
    await req(`${BASE}/GeneratePaper/GetSyllabus`);
    console.log("Using PTS_COOKIE session");
    return;
  }
  const USER = process.env.PTS_USER;
  const PASS = process.env.PTS_PASS;
  if (!USER || !PASS) throw new Error("Set PTS_USER+PTS_PASS or PTS_COOKIE");
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u.toString())).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in to PTS (read-only)");
}

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(?!\/?img\b)[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function optionText(opt = {}) {
  return stripHtml(opt.EmOption || opt.UmOption || "") || "—";
}

function correctLetter(opts = []) {
  const sorted = opts.slice().sort((a, b) => a.OptionID - b.OptionID);
  const idx = sorted.findIndex((o) => o.Answer);
  return idx >= 0 ? "ABCD"[idx] : "A";
}

function chapterNumber(name, i) {
  const m = String(name || "").match(/UNIT\s*(\d+)/i);
  if (m) return Number(m[1]);
  const r = String(name || "").match(/REVIEW\s*(\d+)/i);
  if (r) return Number(r[1]) === 1 ? 6 : 12;
  if (/ENGLISH B/i.test(name || "")) return 15;
  if (/FORMS OF VERBS|TENSES/i.test(name || "")) return 13;
  return i + 1;
}

function topicCode(ref, chapterNum, ti) {
  const r = String(ref || "").trim();
  if (/^\d+$/.test(r)) return `${chapterNum}.${r}`;
  if (/^\d+\.\d+$/.test(r)) return r;
  return `${chapterNum}.${ti + 1}`;
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

function resolveQuestionText(q) {
  const text = q.en?.trim();
  if (text && text !== ".") return text;
  if (q.type === "mcq") return q.source?.trim() || "Select the correct option.";
  return q.ur?.trim() || "";
}

function normalizeMcqOptions(q) {
  const raw = [q.optionA, q.optionB, q.optionC, q.optionD];
  if (!raw.some((v) => String(v || "").trim()) && !q.correctAnswer) return null;
  return {
    optionA: raw[0]?.trim() || "—",
    optionB: raw[1]?.trim() || "—",
    optionC: raw[2]?.trim() || "—",
    optionD: raw[3]?.trim() || "—",
    correctAnswer: q.correctAnswer ? String(q.correctAnswer).toUpperCase() : "A",
  };
}

async function ensureChapterTopic(subject, chapterNum, chapterTitle, topicCodeVal, topicTitle) {
  let chapter = await GenChapter.findOne({
    subject: subject._id,
    order: chapterNum,
  });
  if (!chapter) {
    chapter = await GenChapter.create({
      subject: subject._id,
      name: `${chapterNum}. ${chapterTitle}`,
      order: chapterNum,
    });
  }
  let topic = await GenTopic.findOne({
    chapter: chapter._id,
    code: topicCodeVal,
  });
  if (!topic) {
    const part = String(topicCodeVal).split(".")[1];
    topic = await GenTopic.create({
      chapter: chapter._id,
      name: `${topicCodeVal} ${topicTitle}`,
      order: Number(part) || 0,
      code: topicCodeVal,
    });
  }
  return topic;
}

async function main() {
  await login();
  const hier = await ptsFetch(
    "/AjaxCalling/ChaptersListBySubjectID?SubjectID=64"
  );
  const chaptersList = hier.ChaptersList || [];
  const topicsList = hier.TopicsList || [];
  if (!chaptersList.length) {
    throw new Error("No chapters from ChaptersListBySubjectID");
  }
  console.log(`Hierarchy: ${chaptersList.length} chapters, ${topicsList.length} topics`);
  const chMeta = new Map();
  chaptersList.forEach((ch, i) => {
    chMeta.set(ch.ChapterID, {
      number: chapterNumber(ch.ChapterName, i),
      title: ch.ChapterName,
    });
  });
  const topicMeta = new Map();
  const byChapter = new Map();
  for (const t of topicsList) {
    if (!byChapter.has(t.ChapterID)) byChapter.set(t.ChapterID, []);
    byChapter.get(t.ChapterID).push(t);
  }
  for (const [chId, list] of byChapter) {
    const ch = chMeta.get(chId) || { number: 0, title: "Unknown" };
    list.forEach((t, ti) => {
      topicMeta.set(t.TopicID, {
        chapter: ch.number,
        chapterTitle: String(ch.title)
          .replace(/^UNIT\s*\d+:\s*/i, "")
          .trim(),
        topic_id: topicCode(t.TopicRef, ch.number, ti),
        topicTitle: String(t.TopicName || "")
          .replace(/^\d+(\.\d+)?\s*/, "")
          .trim(),
      });
    });
  }

  const topicIds = topicsList.map((t) => t.TopicID).join(",");
  const questions = [];
  const typeTotals = {};
  for (const type of TYPES) {
    const ids = new Set();
    for (const pri of [1, 2, 3, 7]) {
      const j = await ptsFetch(
        `/AjaxCalling/GetQuestions?TopicIDs=${encodeURIComponent(
          topicIds
        )}&QuestionSubTypeID=${type.id}&QuestionPeriorityID=${pri}&SyllabusType=0`
      );
      for (const raw of j.QuestionsList || []) {
        if (ids.has(raw.QuestionID)) continue;
        ids.add(raw.QuestionID);
        const meta = topicMeta.get(raw.TopicID) || {
          chapter: 13,
          chapterTitle: "Forms of Verbs",
          topic_id: "13.1",
          topicTitle: raw.TopicName || "Topic",
        };
        const en = stripHtml(raw.EnglishQuestionDetails);
        const ur = stripHtml(raw.UrduQuestionDetails);
        const sortedOpts = (raw.MultipleOptions || [])
          .slice()
          .sort((a, b) => a.OptionID - b.OptionID);
        const q = {
          id: raw.QuestionID,
          chapter: meta.chapter,
          chapterTitle: meta.chapterTitle,
          topic_id: meta.topic_id,
          topicTitle: meta.topicTitle,
          type: type.bankType,
          field: type.field,
          subTypeId: type.id,
          source: raw.QuestionPeriority || "Exercise",
          en: en || ur || ".",
          ur: ur && ur !== en ? ur : undefined,
        };
        if (type.bankType === "mcq") {
          q.optionA = optionText(sortedOpts[0] || {});
          q.optionB = optionText(sortedOpts[1] || {});
          q.optionC = optionText(sortedOpts[2] || {});
          q.optionD = optionText(sortedOpts[3] || {});
          q.correctAnswer = correctLetter(sortedOpts);
        }
        questions.push(q);
      }
    }
    typeTotals[type.field] = ids.size;
    console.log(`PTS ${type.field}: ${ids.size}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({ questions, typeTotals, exportedAt: new Date().toISOString() }, null, 2)
  );

  await mongoose.connect(process.env.MONGO_URI);
  const board = await GenBoard.findOne({ name: /PTB|Punjab/i });
  const klass = await GenClass.findOne({ board: board._id, name: /10/i });
  const subject = await GenSubject.findOne({
    class: klass._id,
    name: /^english$/i,
  });
  if (!subject) throw new Error("Class 10 English not found");

  const del = await GenQuestion.deleteMany({
    subject: subject._id,
    subType: { $in: REPLACE_FIELDS },
  });
  console.log(`Deleted old: ${del.deletedCount}`);

  const toCreate = [];
  let skipped = 0;
  for (const q of questions) {
    const topic = await ensureChapterTopic(
      subject,
      q.chapter,
      q.chapterTitle || `Chapter ${q.chapter}`,
      q.topic_id,
      q.topicTitle || q.topic_id
    );
    const text = resolveQuestionText(q);
    if (!topic || !text) {
      skipped += 1;
      continue;
    }
    const type = mapType(q.type);
    const subType = String(q.field).toUpperCase();
    let mcqOptions = null;
    if (type === "MCQ") {
      mcqOptions = normalizeMcqOptions(q);
      if (!mcqOptions) {
        skipped += 1;
        continue;
      }
    }
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
      source: q.source ?? null,
      topic: topic._id,
      chapter: topic.chapter,
      subject: subject._id,
      isActive: true,
      externalKey: `pts-live:10:english:${subType.toLowerCase()}:${q.id}`,
    });
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 400) {
    const chunk = toCreate.slice(i, i + 400);
    try {
      const res = await GenQuestion.insertMany(chunk, { ordered: false });
      created += res.length;
    } catch (err) {
      if (err?.writeErrors) created += chunk.length - err.writeErrors.length;
      else if (err?.code === 11000) created += err.result?.nInserted || 0;
      else throw err;
    }
  }

  const rows = await GenQuestion.aggregate([
    { $match: { subject: subject._id } },
    { $group: { _id: "$subType", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log("Mongo after sync:");
  for (const r of rows) console.log(`  ${r._id}: ${r.n}`);
  console.log({ created, skipped, typeTotals });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
