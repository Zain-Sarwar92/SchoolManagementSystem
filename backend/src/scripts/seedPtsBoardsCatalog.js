/**
 * Upsert PTS Select Syllabus boards + class shells into GenBoard / GenClass.
 * Keeps existing PTB Class 9–12 subject banks (renames Punjab Textbook → PTB,
 * Class 9 → 9TH, etc.).
 *
 *   node src/scripts/seedPtsBoardsCatalog.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import GenBoard from "../models/generator/GenBoard.js";
import GenClass from "../models/generator/GenClass.js";
import { PTS_BOARD_CATALOG } from "../constants/ptsBoardsCatalog.js";

async function findBoard(entry) {
  if (entry.ptsCourseId != null) {
    const byPts = await GenBoard.findOne({ ptsCourseId: entry.ptsCourseId });
    if (byPts) return byPts;
  }
  const names = [entry.name, ...(entry.aliases || [])];
  for (const name of names) {
    const found = await GenBoard.findOne({ name });
    if (found) return found;
  }
  return null;
}

async function findClass(boardId, classEntry) {
  if (classEntry.ptsClassId != null) {
    const byPts = await GenClass.findOne({
      board: boardId,
      ptsClassId: classEntry.ptsClassId,
    });
    if (byPts) return byPts;
  }
  const names = [classEntry.name, ...(classEntry.aliases || [])];
  for (const name of names) {
    const found = await GenClass.findOne({ board: boardId, name });
    if (found) return found;
  }
  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  let boardsUpserted = 0;
  let classesUpserted = 0;

  for (const entry of PTS_BOARD_CATALOG) {
    let board = await findBoard(entry);
    if (!board) {
      board = await GenBoard.create({
        name: entry.name,
        code: entry.code,
        subtitle: entry.subtitle,
        ptsCourseId: entry.ptsCourseId,
        imageUrl: entry.imageUrl,
        sortOrder: entry.sortOrder,
      });
      boardsUpserted += 1;
      console.log(`+ board ${entry.name}`);
    } else {
      board.name = entry.name;
      board.code = entry.code;
      board.subtitle = entry.subtitle;
      board.ptsCourseId = entry.ptsCourseId;
      board.imageUrl = entry.imageUrl;
      board.sortOrder = entry.sortOrder;
      await board.save();
      boardsUpserted += 1;
      console.log(`~ board ${entry.name}`);
    }

    for (const classEntry of entry.classes) {
      let klass = await findClass(board._id, classEntry);
      if (!klass) {
        klass = await GenClass.create({
          board: board._id,
          name: classEntry.name,
          gradeLevel: classEntry.gradeLevel ?? null,
          ptsClassId: classEntry.ptsClassId,
        });
        classesUpserted += 1;
        console.log(`  + class ${entry.name} / ${classEntry.name}`);
      } else {
        klass.name = classEntry.name;
        klass.gradeLevel = classEntry.gradeLevel ?? null;
        klass.ptsClassId = classEntry.ptsClassId;
        await klass.save();
        classesUpserted += 1;
        console.log(`  ~ class ${entry.name} / ${classEntry.name}`);
      }
    }
  }

  console.log(
    `\nDone. Boards touched: ${boardsUpserted}, classes touched: ${classesUpserted}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
