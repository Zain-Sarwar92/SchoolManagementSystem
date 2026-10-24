/**
 * Fill GenSubject.imageUrl from PTS subject logo map (by slug).
 *
 *   node src/scripts/seedPtsSubjectLogos.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenSubject from "../models/generator/GenSubject.js";
import {
  PTS_SUBJECT_LOGOS,
  logoForSubjectSlug,
} from "../constants/ptsSubjectLogos.js";

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  const subjects = await GenSubject.find().select("slug imageUrl name");
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const subject of subjects) {
    const url = logoForSubjectSlug(subject.slug);
    if (!url) {
      missing += 1;
      continue;
    }
    if (subject.imageUrl === url) {
      skipped += 1;
      continue;
    }
    subject.imageUrl = url;
    await subject.save();
    updated += 1;
  }

  console.log(
    `Logos: updated ${updated}, already set ${skipped}, no map for ${missing}`
  );
  console.log(`Mapped slugs: ${Object.keys(PTS_SUBJECT_LOGOS).length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
