/**
 * Built-in Test Generator catalog (PTS-style Select Syllabus).
 * Used only when Mongo has no GenBoard rows.
 */
import { PTS_BOARD_CATALOG } from "./ptsBoardsCatalog.js";

const CORE_SUBJECTS_9 = [
  "English",
  "Urdu",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Islamiyat",
];

const CORE_SUBJECTS_10 = [
  "English",
  "Urdu",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Pakistan Studies",
];

/** Stub tree — board cards match PTS; only PTB mid/high classes list sample subjects */
export const GENERATOR_BOARDS = PTS_BOARD_CATALOG.map((board) => ({
  id: board.code.toLowerCase(),
  name: board.name,
  code: board.code,
  subtitle: board.subtitle,
  imageUrl: board.imageUrl,
  sortOrder: board.sortOrder,
  ptsCourseId: board.ptsCourseId,
  classes: board.classes.map((c) => {
    let subjects = [];
    if (board.code === "PTB" && c.gradeLevel === 9) subjects = CORE_SUBJECTS_9;
    if (board.code === "PTB" && c.gradeLevel === 10) subjects = CORE_SUBJECTS_10;
    if (board.code === "PTB" && c.gradeLevel === 11) subjects = CORE_SUBJECTS_9;
    if (board.code === "PTB" && c.gradeLevel === 12) subjects = CORE_SUBJECTS_10;
    return {
      id: `${board.code.toLowerCase()}-${c.ptsClassId}`,
      name: c.name,
      gradeLevel: c.gradeLevel,
      ptsClassId: c.ptsClassId,
      subjects,
    };
  }),
}));
