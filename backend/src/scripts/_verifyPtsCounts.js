/**
 * Live PTS vs Mongo counts for one class+subject (read-only GetQuestions).
 *   PTS_USER=… PTS_PASS=… node src/scripts/_verifyPtsCounts.js [classId] [subjectIdOrName]
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenQuestion from "../models/generator/GenQuestion.js";
import { resolvePtsSubType } from "../constants/ptsQuestionSubTypes.js";

const BASE = "https://www.paktestsolution.com";
const CLASS_ID = Number(process.argv[2] || 1);
const SUBJECT_ARG = process.argv[3] || "english";
const PRIORITIES = [1, 2, 3, 4, 5];
const TOPIC_CHUNK = 8;
const jar = new Map();

function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function req(url) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
  };
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { headers, redirect: "manual" });
  store(res);
  return res;
}

async function login() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", process.env.PTS_USER);
  u.searchParams.set("password", process.env.PTS_PASS);
  const login = await (await req(u.toString())).json();
  if (!login.IsValid) throw new Error("PTS login failed");
  await req(`${BASE}${login.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
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

async function main() {
  await login();
  const subjects =
    (
      await (
        await req(
          `${BASE}/AjaxCalling/SubjectsListByClassID?ClassID=${CLASS_ID}`
        )
      ).json()
    ).SubjectsList || [];
  const sub =
    subjects.find(
      (s) =>
        String(s.SubjectID) === SUBJECT_ARG ||
        String(s.SubjectName).toLowerCase().includes(SUBJECT_ARG.toLowerCase())
    ) || subjects.find((s) => /english/i.test(s.SubjectName));
  if (!sub) throw new Error("subject not found on PTS");

  const hier = await (
    await req(
      `${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${sub.SubjectID}`
    )
  ).json();
  const topics = hier.TopicsList || [];
  console.log(
    `PTS ${CLASS_ID} / ${sub.SubjectName} (SubjectID ${sub.SubjectID}) topics=${topics.length}`
  );

  const ptsById = {};
  for (let id = 1; id <= 80; id++) {
    const seen = new Set();
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += TOPIC_CHUNK) {
        const chunk = topics.slice(i, i + TOPIC_CHUNK);
        const list = await getQuestions(
          chunk.map((t) => t.TopicID).join(","),
          id,
          pri
        );
        for (const q of list) seen.add(q.QuestionID);
      }
    }
    if (seen.size) {
      ptsById[id] = seen.size;
      process.stdout.write(`\r  subtype ${id}: ${seen.size}   `);
    }
  }
  console.log("\n");

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const klass = await GenClass.findOne({ ptsClassId: CLASS_ID });
  const genSub =
    (await GenSubject.findOne({
      class: klass._id,
      name: new RegExp(sub.SubjectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    })) ||
    (await GenSubject.findOne({ class: klass._id, slug: /english/i }));
  const mongoQs = await GenQuestion.find({
    subject: genSub._id,
    isActive: true,
  })
    .select("externalKey subType type")
    .lean();

  const mongoById = {};
  const mongoByField = {};
  for (const q of mongoQs) {
    const m = String(q.externalKey || "").match(/^pts:\d+:\d+:(\d+):(\d+)$/);
    if (m) {
      const sid = Number(m[1]);
      mongoById[sid] = (mongoById[sid] || 0) + 1;
    }
    const f = String(q.subType || q.type || "").toUpperCase();
    mongoByField[f] = (mongoByField[f] || 0) + 1;
  }

  const ids = [
    ...new Set([
      ...Object.keys(ptsById).map(Number),
      ...Object.keys(mongoById).map(Number),
    ]),
  ].sort((a, b) => a - b);

  console.log(
    "ID | field              | PTS unique | Mongo | match?"
  );
  console.log("-".repeat(60));
  let ok = 0;
  let bad = 0;
  for (const id of ids) {
    const meta = resolvePtsSubType(sub.SubjectName, id, klass.name);
    const pts = ptsById[id] || 0;
    const mon = mongoById[id] || 0;
    const match = pts === mon ? "OK" : "DIFF";
    if (pts === mon) ok += 1;
    else bad += 1;
    console.log(
      `${String(id).padStart(2)} | ${String(meta.field).padEnd(18)} | ${String(pts).padStart(10)} | ${String(mon).padStart(5)} | ${match}`
    );
  }
  console.log("-".repeat(60));
  console.log(
    `PTS total unique Qs: ${Object.values(ptsById).reduce((a, b) => a + b, 0)}`
  );
  console.log(`Mongo questions: ${mongoQs.length}`);
  console.log(`Subtype rows OK: ${ok}, DIFF: ${bad}`);
  console.log("Mongo by field:", mongoByField);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
