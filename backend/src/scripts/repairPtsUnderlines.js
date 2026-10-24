/**
 * Restore <u>/<strong>/… in GenQuestion.text from PTS raw exports.
 * Also patches matching rows in pts-live / lahore-board all-questions.json.
 *
 *   node src/scripts/repairPtsUnderlines.js
 *   node src/scripts/repairPtsUnderlines.js --dry
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import GenQuestion from "../models/generator/GenQuestion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../data");

const KEEP_TAGS = new Set([
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

function preservePtsHtml(html) {
  if (!html) return "";
  let s = String(html);
  /* Convert style-based underlines to <u> before tag filter. */
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
    if (!KEEP_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br />";
    if (name === "img") {
      const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
      let src = (srcMatch?.[2] || "").trim().replace(/\\/g, "/");
      if (!src) return "";
      if (src.startsWith("//")) src = `https:${src}`;
      const altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
      const alt = altMatch?.[2] ?? "";
      return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" />`;
    }
    return `<${name}>`;
  });
  s = s
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&");
  return s.replace(/\r\n/g, "\n").trim();
}

function walkRaw(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkRaw(full, files);
    else if (/pts-raw/i.test(full) && /\.json$/i.test(name) && !/hierarchy/i.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function loadUnderlinedById() {
  const files = [
    ...walkRaw(path.join(ROOT, "lahore-board")),
    ...walkRaw(path.join(ROOT, "pts-live")),
  ];
  const byId = new Map();
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const list = Array.isArray(data?.questions) ? data.questions : [];
    for (const raw of list) {
      const id = raw.QuestionID ?? raw.id;
      if (id == null) continue;
      const enRaw = raw.EnglishQuestionDetails || "";
      const urRaw = raw.UrduQuestionDetails || "";
      if (!/<u\b/i.test(enRaw + urRaw) && !/text-decoration\s*:\s*underline/i.test(enRaw + urRaw)) {
        continue;
      }
      const en = preservePtsHtml(enRaw);
      const ur = preservePtsHtml(urRaw);
      if (!/<u\b/i.test(en + ur)) continue;
      byId.set(String(id), {
        en: en || ur,
        ur: ur && ur !== en ? ur : null,
      });
    }
  }
  return { byId, files: files.length };
}

function patchAllQuestionsJson(byId, dry) {
  const targets = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name === "all-questions.json") targets.push(full);
    }
  }
  walk(path.join(ROOT, "pts-live"));
  walk(path.join(ROOT, "lahore-board"));

  let patched = 0;
  for (const file of targets) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const list = Array.isArray(data?.questions) ? data.questions : null;
    if (!list) continue;
    let dirty = false;
    for (const q of list) {
      const id = String(q.id ?? q.QuestionID ?? "");
      const next = byId.get(id);
      if (!next) continue;
      if (!/<u\b/i.test(String(q.en || "")) && next.en) {
        q.en = next.en;
        dirty = true;
        patched += 1;
      }
      if (next.ur && !/<u\b/i.test(String(q.ur || ""))) {
        q.ur = next.ur;
        dirty = true;
      }
    }
    if (dirty && !dry) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
  }
  return patched;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const { byId, files } = loadUnderlinedById();
  console.log(`Underlined stems from raw: ${byId.size} (raw files=${files})`);

  const jsonPatched = patchAllQuestionsJson(byId, dry);
  console.log(
    `${dry ? "Would patch" : "Patched"} all-questions.json rows: ${jsonPatched}`
  );

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const docs = await GenQuestion.find({
    text: { $not: /<u\b/i },
    externalKey: { $exists: true, $ne: null },
  })
    .select("_id externalKey text textUrdu subType")
    .lean();

  console.log(`DB questions without <u>: ${docs.length}`);

  let updated = 0;
  let skipped = 0;
  const bySub = {};
  const ops = [];

  for (const doc of docs) {
    const id = String(doc.externalKey || "").split(":").pop();
    const next = byId.get(id);
    if (!next) {
      skipped += 1;
      continue;
    }
    const patch = {};
    if (next.en && doc.text !== next.en) patch.text = next.en;
    if (next.ur != null && String(doc.textUrdu || "") !== next.ur) {
      patch.textUrdu = next.ur;
    }
    if (!Object.keys(patch).length) continue;
    const st = doc.subType || "?";
    bySub[st] = (bySub[st] || 0) + 1;
    if (dry) {
      if (updated < 3) {
        console.log("DRY", doc.externalKey, st, "→", next.en.slice(0, 100));
      }
      updated += 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: patch },
      },
    });
    updated += 1;
  }

  if (!dry && ops.length) {
    for (let i = 0; i < ops.length; i += 500) {
      await GenQuestion.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }
  }

  console.log(
    `${dry ? "Would update" : "Updated"} ${updated}; no raw match=${skipped}`
  );
  console.log("by subType", bySub);

  /* Sanity: Class 9 Urdu PASSAGE sample */
  const sample = await GenQuestion.findOne({
    subType: "PASSAGE",
    externalKey: /:50:48:/,
    text: /<u\b/i,
  })
    .select("text externalKey")
    .lean();
  if (sample) {
    console.log("PASSAGE sample OK:", sample.externalKey, sample.text.slice(0, 120));
  } else {
    console.log("WARN: no underlined PASSAGE sample for subject 50");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
