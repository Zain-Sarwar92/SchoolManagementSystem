import "../models/Subject.js"; // register model for Curriculum.populate("subjects")
import Curriculum from "../models/Curriculum.js";
import {
  GROUP_LABELS,
  groupsForGrade,
  isGroupValidForGrade,
} from "../constants/scienceCurriculum.js";

/**
 * Resolve ordered subjects for a Science grade + group package.
 * @returns {Promise<{ curriculum: object|null, subjects: object[] }>}
 */
export const getSubjectsForGroup = async (
  gradeLevel,
  group,
  stream = "science"
) => {
  const grade = Number(gradeLevel);

  if (!grade || !group) {
    return { curriculum: null, subjects: [] };
  }

  if (!isGroupValidForGrade(group, grade)) {
    const allowed = groupsForGrade(grade)
      .map((g) => GROUP_LABELS[g] || g)
      .join(", ");
    const error = new Error(
      `Group "${GROUP_LABELS[group] || group}" is not valid for grade ${grade}. Allowed: ${allowed || "none"}`
    );
    error.statusCode = 400;
    throw error;
  }

  const curriculum = await Curriculum.findOne({
    stream,
    gradeLevel: grade,
    group,
  }).populate("subjects");

  if (!curriculum) {
    const error = new Error(
      `No Science curriculum found for grade ${grade} / ${GROUP_LABELS[group] || group}. Run seedScienceCurriculum.`
    );
    error.statusCode = 404;
    throw error;
  }

  const subjects = (curriculum.subjects || []).filter(
    (item) => item && item.isActive !== false
  );

  return { curriculum, subjects };
};
