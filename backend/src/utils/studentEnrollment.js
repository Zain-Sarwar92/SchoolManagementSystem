import StudentSubject from "../models/StudentSubject.js";
import { getSubjectsForGroup } from "./curriculum.js";
import { inferGradeFromClassName } from "../constants/majors.js";

/** Short safe token for roll parts (e.g. "Blue" → "Blue"). */
export const rollSlug = (text = "") =>
  String(text)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 12) || "X";

/**
 * Roll prefix unique per class+section, e.g. Class 9 / A → "9-A", Class 10 / Blue → "10-Blue"
 */
export const buildRollPrefix = (className = "", sectionName = "") => {
  const grade = inferGradeFromClassName(className);
  const classPart = grade ? String(grade) : rollSlug(className).slice(0, 8);
  const sectionPart = rollSlug(sectionName).slice(0, 10);
  return `${classPart}-${sectionPart}`;
};

export const formatSectionRoll = (prefix, seq, width = 2) =>
  `${prefix}-${String(seq).padStart(width, "0")}`;

export const syncStudentSubjects = async ({
  academyId,
  studentId,
  classId,
  gradeLevel,
  group,
  major = "science",
}) => {
  await StudentSubject.deleteMany({ student: studentId });

  if (major !== "science") {
    return [];
  }

  if (!gradeLevel || !group) {
    return [];
  }

  const { subjects } = await getSubjectsForGroup(gradeLevel, group, "science");

  if (subjects.length === 0) return [];

  await StudentSubject.insertMany(
    subjects.map((subject) => ({
      academy: academyId,
      student: studentId,
      class: classId,
      group,
      subject: subject._id,
    }))
  );

  return subjects;
};

/**
 * Batch-enroll many students by group — one curriculum lookup per group.
 * students: [{ _id, group, major }]
 */
export const syncManyStudentSubjects = async ({
  academyId,
  classId,
  gradeLevel,
  students = [],
}) => {
  const scienceStudents = students.filter((s) => s.major === "science");
  if (!gradeLevel || scienceStudents.length === 0) {
    return { enrolled: 0, skipped: students.length };
  }

  const ids = scienceStudents.map((s) => s._id);
  await StudentSubject.deleteMany({ student: { $in: ids } });

  const byGroup = new Map();
  for (const student of scienceStudents) {
    if (!student.group) continue;
    if (!byGroup.has(student.group)) byGroup.set(student.group, []);
    byGroup.get(student.group).push(student);
  }

  const subjectCache = new Map();
  const docs = [];
  let enrolled = 0;
  let skipped = students.length - scienceStudents.length;

  for (const [group, groupStudents] of byGroup) {
    let subjects = subjectCache.get(group);
    if (!subjects) {
      try {
        const result = await getSubjectsForGroup(gradeLevel, group, "science");
        subjects = result.subjects || [];
        subjectCache.set(group, subjects);
      } catch {
        skipped += groupStudents.length;
        continue;
      }
    }

    if (subjects.length === 0) {
      skipped += groupStudents.length;
      continue;
    }

    enrolled += groupStudents.length;
    for (const student of groupStudents) {
      for (const subject of subjects) {
        docs.push({
          academy: academyId,
          student: student._id,
          class: classId,
          group,
          subject: subject._id,
        });
      }
    }
  }

  if (docs.length) {
    await StudentSubject.insertMany(docs, { ordered: false });
  }

  return { enrolled, skipped, rows: docs.length };
};

/**
 * Suggest next roll from students already in this section.
 * Works for plain numbers (9501→9502) and prefixed (9-A-01→9-A-02).
 * First student in empty section: user enters roll manually.
 */
export const suggestNextRollNumber = async (
  Student,
  academyId,
  sectionId,
  { className = "", sectionName = "", session = "" } = {}
) => {
  const prefixHint = buildRollPrefix(className, sectionName);
  const filter = {
    academy: academyId,
    section: sectionId,
  };
  if (session) filter.session = session;

  const rows = await Student.find(filter)
    .select("rollNumber")
    .lean();

  if (rows.length === 0) {
    return {
      hasStudents: false,
      nextRollNumber: "",
      isFirstStudent: true,
      rollPrefix: prefixHint,
    };
  }

  let best = null;
  for (const row of rows) {
    const roll = String(row.rollNumber || "").trim();
    const match = roll.match(/^(.*?)(\d+)$/);
    if (!match) continue;
    const value = Number(match[2]);
    if (!best || value > best.value) {
      best = { prefix: match[1], value, width: match[2].length };
    }
  }

  if (!best) {
    return {
      hasStudents: true,
      nextRollNumber: "",
      isFirstStudent: false,
      rollPrefix: prefixHint,
    };
  }

  return {
    hasStudents: true,
    nextRollNumber: `${best.prefix}${String(best.value + 1).padStart(best.width, "0")}`,
    isFirstStudent: false,
    rollPrefix: prefixHint,
  };
};
