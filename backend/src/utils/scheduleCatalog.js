import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import Academy from "../models/Academy.js";
import "../models/User.js"; // register for TeacherAssignment.teacher populate
import TeacherAssignment from "../models/TeacherAssignment.js";
import { SCIENCE_CURRICULUM_PACKAGES } from "../constants/scienceCurriculum.js";
import { ensureTestGeneratorCurriculum } from "./testGeneratorCurriculum.js";

const PRIMARY_SUBJECT_NAMES = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Islamiyat",
  "Social Studies",
];

function sortByName(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function ensureSubjectsByName(names) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  // Prefer oldest doc when duplicate names exist (legacy DB without unique enforcement).
  const existing = await Subject.find({ name: { $in: unique } })
    .sort({ _id: 1 })
    .lean();
  const byName = new Map();
  for (const subject of existing) {
    if (!byName.has(subject.name)) byName.set(subject.name, subject);
  }

  for (const name of unique) {
    if (byName.has(name)) continue;
    try {
      const created = await Subject.create({ name, stream: "science" });
      byName.set(name, created.toObject());
    } catch (err) {
      if (err?.code !== 11000) throw err;
      const again = await Subject.findOne({ name }).sort({ _id: 1 }).lean();
      if (again) byName.set(name, again);
    }
  }
  return byName;
}

function subjectNamesForGrade(gradeLevel) {
  const grade = Number(gradeLevel);
  if (!grade) return [...PRIMARY_SUBJECT_NAMES];
  if (grade >= 1 && grade <= 8) return [...PRIMARY_SUBJECT_NAMES];

  const names = new Set();
  for (const pkg of SCIENCE_CURRICULUM_PACKAGES) {
    if (pkg.gradeLevel === grade) {
      for (const name of pkg.subjects) names.add(name);
    }
  }
  return names.size ? [...names] : [...PRIMARY_SUBJECT_NAMES];
}

/**
 * Build Green-Book-style schedule catalog for an academy.
 * One synthetic board wraps all academy classes (no global boards yet).
 */
export async function buildScheduleCatalog(academyId) {
  const [classes, sections, assignments] = await Promise.all([
    Class.find({ academy: academyId, isActive: true }).sort({ name: 1 }).lean(),
    Section.find({ academy: academyId, isActive: true }).sort({ name: 1 }).lean(),
    TeacherAssignment.find({ academy: academyId })
      .populate("teacher", "name email isActive role")
      .lean(),
  ]);

  const allNames = new Set();
  for (const klass of classes) {
    for (const name of subjectNamesForGrade(klass.gradeLevel)) {
      allNames.add(name);
    }
  }
  const subjectByName = await ensureSubjectsByName([...allNames]);

  const sectionsByClassId = new Map();
  for (const section of sections) {
    const key = String(section.class);
    const list = sectionsByClassId.get(key) || [];
    list.push({ id: String(section._id), name: section.name });
    sectionsByClassId.set(key, list);
  }

  const teachersBySubjectClass = new Map();
  for (const mapping of assignments) {
    const teacher = mapping.teacher;
    if (!teacher || teacher.isActive === false || teacher.role !== "teacher") {
      continue;
    }
    const subjectClassKey = `${mapping.subject}:${mapping.class}`;
    let sectionMap = teachersBySubjectClass.get(subjectClassKey);
    if (!sectionMap) {
      sectionMap = new Map();
      teachersBySubjectClass.set(subjectClassKey, sectionMap);
    }
    const sectionId = String(mapping.section);
    const list = sectionMap.get(sectionId) || [];
    if (!list.some((t) => t.id === String(teacher._id))) {
      list.push({
        id: String(teacher._id),
        name: teacher.name,
        email: teacher.email,
      });
    }
    sectionMap.set(sectionId, list);
  }

  const catalogClasses = classes
    .map((klass) => {
      const classId = String(klass._id);
      const names = subjectNamesForGrade(klass.gradeLevel).sort(sortByName);
      return {
        classId,
        className: klass.name,
        gradeLevel: klass.gradeLevel,
        sections: (sectionsByClassId.get(classId) || []).sort((a, b) =>
          sortByName(a.name, b.name)
        ),
        subjects: names
          .map((subjectName) => {
            const subject = subjectByName.get(subjectName);
            if (!subject) return null;
            const sectionMap =
              teachersBySubjectClass.get(`${subject._id}:${klass._id}`) ||
              new Map();
            const teachersBySectionId = {};
            for (const [sectionId, teachers] of sectionMap.entries()) {
              teachersBySectionId[sectionId] = teachers;
            }
            return {
              subjectId: String(subject._id),
              subjectName,
              teachersBySectionId,
            };
          })
          .filter(Boolean),
      };
    })
    .filter((row) => row.sections.length > 0)
    .sort((a, b) => sortByName(a.className, b.className));

  return [
    {
      boardId: "academy",
      boardName: "Academy curriculum",
      classes: catalogClasses,
    },
  ].filter((board) => board.classes.length > 0);
}
