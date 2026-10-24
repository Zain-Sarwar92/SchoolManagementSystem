/**
 * Remap already-imported primary English questions so each PTS subtype ID
 * keeps its own subType (WORD / TRACE / GENDER / …) instead of merged labels.
 *
 *   node src/scripts/fixPtsPrimaryEnglishSubtypes.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import GenQuestion from "../models/generator/GenQuestion.js";
import { resolvePtsSubType } from "../constants/ptsQuestionSubTypes.js";

const PRIMARY_CLASS_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

function mapType(bankType) {
  if (bankType === "long") return "LONG";
  if (bankType === "mcq") return "MCQ";
  return "SHORT";
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  let updated = 0;

  for (const classId of PRIMARY_CLASS_IDS) {
    const klass = await GenClass.findOne({ ptsClassId: classId });
    if (!klass) continue;
    const subjects = await GenSubject.find({
      class: klass._id,
      slug: /english/i,
    });
    for (const subject of subjects) {
      const qs = await GenQuestion.find({ subject: subject._id }).select(
        "_id externalKey type subType"
      );
      for (const q of qs) {
        const m = String(q.externalKey || "").match(
          /^pts:(\d+):(\d+):(\d+):(\d+)$/
        );
        if (!m) continue;
        const subTypeId = Number(m[3]);
        const meta = resolvePtsSubType(subject.name, subTypeId, klass.name);
        const nextType = mapType(meta.bankType);
        const nextSub = String(meta.field || "").toUpperCase();
        if (q.type === nextType && q.subType === nextSub) continue;
        await GenQuestion.updateOne(
          { _id: q._id },
          { $set: { type: nextType, subType: nextSub } }
        );
        updated += 1;
      }
      console.log(
        `${klass.name} / ${subject.name}: scanned ${qs.length}, remapped so far ${updated}`
      );
    }
  }

  console.log(`Done. Updated ${updated} questions.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
