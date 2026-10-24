/**
 * Chapter × question-type counts for every seeded Gen* subject.
 * Optional live PTS verify: --verify (slow; uses PTS_USER/PTS_PASS).
 *
 *   node src/scripts/reportPtsBankMatrix.js
 *   node src/scripts/reportPtsBankMatrix.js --verify
 *   node src/scripts/reportPtsBankMatrix.js --verify --board PTB --class ONE
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
const OUT_DIR = path.resolve(__dirname, "../../data/pts-live");
const BASE = "https://www.paktestsolution.com";
const PRIORITIES = [1, 2, 3, 4, 5];
const TOPIC_CHUNK = 8;

const args = parseArgs(process.argv.slice(2));
const jar = new Map();

function parseArgs(argv) {
  const out = { verify: false, board: null, class: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--verify") out.verify = true;
    else if (argv[i] === "--board") out.board = String(argv[++i] || "").toUpperCase();
    else if (argv[i] === "--class") out.class = String(argv[++i] || "").toUpperCase();
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function ptsLogin() {
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
  for (let a = 1; a <= 3; a += 1) {
    try {
      const res = await req(u.toString());
      if (!res.ok) {
        await sleep(200 * a);
        continue;
      }
      return JSON.parse(await res.text()).QuestionsList || [];
    } catch {
      await sleep(250 * a);
    }
  }
  return [];
}

async function mongoMatrixForSubject(subject, className) {
  const chapters = await GenChapter.find({ subject: subject._id })
    .sort({ order: 1 })
    .lean();
  const rows = [];
  let subjectTotal = 0;
  const byType = {};

  for (const ch of chapters) {
    const topics = await GenTopic.find({ chapter: ch._id }).select("_id").lean();
    const topicIds = topics.map((t) => t._id);
    if (!topicIds.length) {
      rows.push({ chapter: ch.name, order: ch.order, types: {}, total: 0 });
      continue;
    }
    const agg = await GenQuestion.aggregate([
      {
        $match: {
          subject: subject._id,
          chapter: ch._id,
          isActive: true,
        },
      },
      { $group: { _id: "$subType", c: { $sum: 1 } } },
    ]);
    const types = {};
    let total = 0;
    for (const a of agg) {
      const key = String(a._id || "UNKNOWN").toUpperCase();
      types[key] = a.c;
      total += a.c;
      byType[key] = (byType[key] || 0) + a.c;
    }
    subjectTotal += total;
    rows.push({
      chapter: ch.name,
      order: ch.order,
      types,
      total,
    });
  }

  return { chapters: rows, byType, total: subjectTotal, className };
}

async function ptsVerifySubject(ptsClassId, ptsSubjectId, subjectName, className) {
  const hier = await (
    await req(
      `${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${ptsSubjectId}`
    )
  ).json();
  const topics = hier.TopicsList || [];
  const chapters = hier.ChaptersList || [];

  const subtypeHits = [];
  for (let id = 1; id <= 80; id++) {
    let hit = false;
    outer: for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += TOPIC_CHUNK) {
        const list = await getQuestions(
          topics
            .slice(i, i + TOPIC_CHUNK)
            .map((t) => t.TopicID)
            .join(","),
          id,
          pri
        );
        await sleep(40);
        if (list.length) {
          hit = true;
          break outer;
        }
      }
    }
    if (hit) subtypeHits.push(id);
  }

  const byChapterType = {};
  const byType = {};
  let total = 0;

  for (const sid of subtypeHits) {
    const meta = resolvePtsSubType(subjectName, sid, className);
    const field = String(meta.field).toUpperCase();
    const seen = new Set();
    const qMeta = new Map();
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += TOPIC_CHUNK) {
        const chunk = topics.slice(i, i + TOPIC_CHUNK);
        const list = await getQuestions(
          chunk.map((t) => t.TopicID).join(","),
          sid,
          pri
        );
        await sleep(40);
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          qMeta.set(q.QuestionID, q.TopicID);
        }
      }
    }
    const topicToChapter = new Map();
    for (const t of topics) topicToChapter.set(t.TopicID, t.ChapterID);
    const chapterName = new Map();
    chapters.forEach((c, i) => {
      chapterName.set(c.ChapterID, c.ChapterName || `Chapter ${i + 1}`);
    });

    for (const [, topicId] of qMeta) {
      const chId = topicToChapter.get(topicId);
      const chLabel = chapterName.get(chId) || String(chId);
      if (!byChapterType[chLabel]) byChapterType[chLabel] = {};
      byChapterType[chLabel][field] =
        (byChapterType[chLabel][field] || 0) + 1;
      byType[field] = (byType[field] || 0) + 1;
      total += 1;
    }
  }

  return { byChapterType, byType, total, subtypes: subtypeHits };
}

function formatSubjectBlock(board, klass, subject, matrix, verify) {
  const lines = [];
  lines.push(`## ${board.name} / ${klass.name} / ${subject.name}`);
  lines.push("");
  lines.push(`**Mongo total:** ${matrix.total}`);
  if (verify) {
    lines.push(`**PTS total:** ${verify.total}`);
    lines.push(
      verify.total === matrix.total
        ? "**Subject match:** OK"
        : `**Subject match:** DIFF (mongo ${matrix.total} vs pts ${verify.total})`
    );
  }
  lines.push("");
  lines.push("| Chapter | Type | Mongo | PTS | Match |");
  lines.push("|---|---|---:|---:|---|");

  const chapterNames = matrix.chapters.map((c) => c.chapter);
  const allTypes = new Set();
  for (const ch of matrix.chapters) {
    Object.keys(ch.types).forEach((t) => allTypes.add(t));
  }
  if (verify?.byChapterType) {
    for (const types of Object.values(verify.byChapterType)) {
      Object.keys(types).forEach((t) => allTypes.add(t));
    }
  }

  for (const ch of matrix.chapters) {
    const ptsCh =
      verify?.byChapterType?.[ch.chapter] ||
      findLooseChapter(verify?.byChapterType, ch.chapter) ||
      {};
    const types = [
      ...new Set([...Object.keys(ch.types), ...Object.keys(ptsCh)]),
    ].sort();
    if (!types.length) {
      lines.push(`| ${ch.chapter} | — | 0 | 0 | OK |`);
      continue;
    }
    for (const t of types) {
      const m = ch.types[t] || 0;
      const p = verify ? ptsCh[t] || 0 : "—";
      const match = !verify ? "—" : m === p ? "OK" : "DIFF";
      lines.push(`| ${ch.chapter} | ${t} | ${m} | ${p} | ${match} |`);
    }
  }
  lines.push("");
  return { md: lines.join("\n"), chapterNames };
}

function findLooseChapter(map, name) {
  if (!map) return null;
  if (map[name]) return map[name];
  const n = String(name || "").toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (String(k).toLowerCase().includes(n) || n.includes(String(k).toLowerCase())) {
      return v;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  if (args.verify) {
    if (!process.env.PTS_USER || !process.env.PTS_PASS) {
      throw new Error("PTS_USER + PTS_PASS required for --verify");
    }
    await ptsLogin();
    console.log("PTS login OK — verifying live counts");
  }

  const boards = await GenBoard.find().sort({ sortOrder: 1, name: 1 }).lean();
  const report = {
    generatedAt: new Date().toISOString(),
    verify: args.verify,
    subjects: [],
  };
  const mdParts = [
    `# PTS Bank Matrix`,
    ``,
    `Generated: ${report.generatedAt}`,
    `Live verify: ${args.verify ? "yes" : "no (mongo only)"}`,
    ``,
  ];

  for (const board of boards) {
    if (args.board && board.name.toUpperCase() !== args.board && board.code?.toUpperCase() !== args.board) {
      continue;
    }
    const classes = await GenClass.find({ board: board._id }).sort({
      gradeLevel: 1,
      name: 1,
    }).lean();
    for (const klass of classes) {
      if (
        args.class &&
        String(klass.name).toUpperCase() !== args.class &&
        String(klass.ptsClassId) !== args.class
      ) {
        continue;
      }
      const subjects = await GenSubject.find({ class: klass._id }).sort({
        name: 1,
      }).lean();
      for (const subject of subjects) {
        const qCount = await GenQuestion.countDocuments({
          subject: subject._id,
          isActive: true,
        });
        if (!qCount) continue;

        console.log(`\n${board.name} / ${klass.name} / ${subject.name} (${qCount})`);
        const matrix = await mongoMatrixForSubject(subject, klass.name);
        let verify = null;
        if (args.verify && klass.ptsClassId != null) {
          const ptsSubs =
            (
              await (
                await req(
                  `${BASE}/AjaxCalling/SubjectsListByClassID?ClassID=${klass.ptsClassId}`
                )
              ).json()
            ).SubjectsList || [];
          const ptsSub =
            ptsSubs.find(
              (s) =>
                String(s.SubjectName).trim().toLowerCase() ===
                String(subject.name).trim().toLowerCase()
            ) ||
            ptsSubs.find((s) =>
              String(s.SubjectName)
                .toLowerCase()
                .includes(String(subject.slug || "").slice(0, 6))
            );
          if (ptsSub) {
            console.log(`  live verify SubjectID=${ptsSub.SubjectID}…`);
            verify = await ptsVerifySubject(
              klass.ptsClassId,
              ptsSub.SubjectID,
              subject.name,
              klass.name
            );
            console.log(
              `  PTS ${verify.total} vs Mongo ${matrix.total} → ${
                verify.total === matrix.total ? "OK" : "DIFF"
              }`
            );
          } else {
            console.warn("  PTS subject not found — skip live verify");
          }
        }

        const block = formatSubjectBlock(board, klass, subject, matrix, verify);
        mdParts.push(block.md);
        report.subjects.push({
          board: board.name,
          class: klass.name,
          subject: subject.name,
          slug: subject.slug,
          mongo: matrix,
          pts: verify,
          match:
            verify == null ? null : verify.total === matrix.total,
        });
      }
    }
  }

  const mdPath = path.join(OUT_DIR, "_bank-matrix.md");
  const jsonPath = path.join(OUT_DIR, "_bank-matrix.json");
  fs.writeFileSync(mdPath, mdParts.join("\n"));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
