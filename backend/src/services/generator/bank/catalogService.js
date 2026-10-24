import GenBoard from "../../../models/generator/GenBoard.js";
import GenClass from "../../../models/generator/GenClass.js";
import GenSubject from "../../../models/generator/GenSubject.js";
import { GENERATOR_BOARDS } from "../../../constants/generatorCatalog.js";

/** TECH stream subjects stay after regular subjects in the picker. */
function isTechSubject(s) {
  const name = String(s?.name || "");
  const slug = String(s?.slug || "");
  return /\(TECH\)/i.test(name) || /-tech$/i.test(slug);
}

function sortSubjectsForCatalog(subjects) {
  return [...subjects].sort((a, b) => {
    const aTech = isTechSubject(a);
    const bTech = isTechSubject(b);
    if (aTech !== bTech) return aTech ? 1 : -1;
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
    });
  });
}

/**
 * Board → class → subject tree (PTS Select Syllabus order).
 * Prefer DB curriculum; fallback stub when Mongo has no boards.
 */
export async function getCatalog() {
  const boards = await GenBoard.find()
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  if (!boards.length) {
    return { boards: GENERATOR_BOARDS, source: "stub" };
  }

  const tree = [];
  for (const board of boards) {
    const classes = await GenClass.find({ board: board._id })
      .sort({ gradeLevel: 1, name: 1 })
      .lean();
    const classNodes = [];
    for (const klass of classes) {
      const subjects = sortSubjectsForCatalog(
        await GenSubject.find({ class: klass._id }).lean()
      );
      classNodes.push({
        id: String(klass._id),
        name: klass.name,
        gradeLevel: klass.gradeLevel,
        ptsClassId: klass.ptsClassId ?? null,
        subjects: subjects.map((s) => ({
          id: String(s._id),
          name: s.name,
          slug: s.slug,
          imageUrl: s.imageUrl || "",
        })),
      });
    }
    tree.push({
      id: String(board._id),
      name: board.name,
      code: board.code || "",
      subtitle: board.subtitle || "Syllabus",
      imageUrl: board.imageUrl || "",
      sortOrder: board.sortOrder ?? 100,
      ptsCourseId: board.ptsCourseId ?? null,
      classes: classNodes,
    });
  }

  return { boards: tree, source: "db" };
}
