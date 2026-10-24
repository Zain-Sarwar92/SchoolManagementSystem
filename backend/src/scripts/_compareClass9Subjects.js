/**
 * Compare PTS Class 9 subjects vs Mongo GenSubject for PTB 9TH.
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";

const BASE = "https://www.paktestsolution.com";
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

function norm(n) {
  return String(n || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function main() {
  const USER = process.env.PTS_USER;
  const PASS = process.env.PTS_PASS;
  if (!USER || !PASS) throw new Error("PTS_USER+PTS_PASS required");

  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const login = await (await req(u.toString())).json();
  if (!login.IsValid) throw new Error("PTS login failed");
  await req(`${BASE}${login.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);

  const ptsJson = await (
    await req(`${BASE}/AjaxCalling/SubjectsListByClassID?ClassID=9`)
  ).json();
  const ptsSubs = (ptsJson.SubjectsList || [])
    .map((s) => ({ id: s.SubjectID, name: s.SubjectName }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "en"));

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const board = await GenBoard.findOne({
    $or: [{ code: "PTB" }, { name: "PTB" }, { ptsCourseId: 1 }],
  });
  if (!board) throw new Error("PTB board not found in Mongo");

  const klass = await GenClass.findOne({
    board: board._id,
    $or: [
      { ptsClassId: 9 },
      { name: /^9TH$/i },
      { name: /^Class\s*9$/i },
      { gradeLevel: 9 },
    ],
  });
  if (!klass) throw new Error("Class 9 not found in Mongo");

  const mongoSubs = await GenSubject.find({ class: klass._id })
    .sort({ name: 1 })
    .lean();

  console.log(`PTS ClassID=9 subjects: ${ptsSubs.length}`);
  ptsSubs.forEach((s, i) =>
    console.log(`  PTS ${String(i + 1).padStart(2)}  ${s.id}  ${s.name}`)
  );
  console.log("");
  console.log(
    `Mongo: ${klass.name} (ptsClassId=${klass.ptsClassId}) subjects: ${mongoSubs.length}`
  );
  mongoSubs.forEach((s, i) =>
    console.log(
      `  MON ${String(i + 1).padStart(2)}  ${s.ptsSubjectId ?? "-"}  ${s.name} | ${s.slug}`
    )
  );

  const byId = new Map(
    mongoSubs
      .filter((s) => s.ptsSubjectId != null)
      .map((s) => [Number(s.ptsSubjectId), s])
  );
  const byName = new Map(mongoSubs.map((s) => [norm(s.name), s]));

  const missingInMongo = [];
  const matched = [];
  for (const p of ptsSubs) {
    const m = byId.get(Number(p.id)) || byName.get(norm(p.name));
    if (m) matched.push({ pts: p.name, mongo: m.name, id: p.id });
    else missingInMongo.push(p);
  }

  const extraInMongo = mongoSubs.filter((s) => {
    if (
      s.ptsSubjectId != null &&
      ptsSubs.some((p) => Number(p.id) === Number(s.ptsSubjectId))
    ) {
      return false;
    }
    return !ptsSubs.some((p) => norm(p.name) === norm(s.name));
  });

  console.log("");
  console.log(`MATCHED ${matched.length} / ${ptsSubs.length}`);
  console.log(`MISSING_IN_MONGO ${missingInMongo.length}`);
  for (const p of missingInMongo) console.log(`  - ${p.id} ${p.name}`);
  console.log(`EXTRA_IN_MONGO ${extraInMongo.length}`);
  for (const s of extraInMongo)
    console.log(`  + ${s.ptsSubjectId ?? "-"} ${s.name}`);

  const equal =
    ptsSubs.length === mongoSubs.length &&
    missingInMongo.length === 0 &&
    extraInMongo.length === 0;
  console.log("");
  console.log(
    `VERDICT: ${
      equal
        ? "YES — same count and same subject set"
        : ptsSubs.length === mongoSubs.length && missingInMongo.length === 0
          ? "SAME COUNT but naming differs"
          : `NO — PTS=${ptsSubs.length} Mongo=${mongoSubs.length}`
    }`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
