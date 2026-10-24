/**
 * Upsert GenSubject shells for every PTS class (from data/pts-class-subjects.json).
 * Does not touch chapters/questions — only subject cards for catalog UI.
 *
 *   node src/scripts/seedPtsClassSubjects.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import GenClass from "../models/generator/GenClass.js";
import GenSubject from "../models/generator/GenSubject.js";
import { logoForSubjectSlug } from "../constants/ptsSubjectLogos.js";

const DATA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/pts-class-subjects.json"
);

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  const byClass = JSON.parse(fs.readFileSync(DATA, "utf8"));

  await mongoose.connect(uri);
  let created = 0;
  let updated = 0;

  for (const [classId, subjects] of Object.entries(byClass)) {
    const klass = await GenClass.findOne({ ptsClassId: Number(classId) });
    if (!klass || !subjects?.length) continue;

    for (const row of subjects) {
      const imageUrl = row.imageUrl || logoForSubjectSlug(row.slug) || "";
      let subject =
        (await GenSubject.findOne({ class: klass._id, slug: row.slug })) ||
        (await GenSubject.findOne({ class: klass._id, name: row.name }));

      if (!subject) {
        try {
          await GenSubject.create({
            class: klass._id,
            name: row.name,
            slug: row.slug,
            imageUrl,
          });
          created += 1;
        } catch (err) {
          if (err?.code !== 11000) throw err;
        }
        continue;
      }

      let dirty = false;
      if (subject.slug !== row.slug) {
        const clash = await GenSubject.findOne({
          class: klass._id,
          slug: row.slug,
          _id: { $ne: subject._id },
        });
        if (!clash) {
          subject.slug = row.slug;
          dirty = true;
        }
      }
      if (imageUrl && subject.imageUrl !== imageUrl) {
        subject.imageUrl = imageUrl;
        dirty = true;
      }
      if (dirty) {
        await subject.save();
        updated += 1;
      }
    }
  }

  console.log(`Subjects: created ${created}, updated ${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
