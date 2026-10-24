/**
 * Create 2 exams for Class 9 / Blue and fill marks on both.
 * Usage: node src/scripts/seedTwoExamsBlue9.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import StudentSubject from "../models/StudentSubject.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import StudentMark from "../models/StudentMark.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const TOTAL_MARKS = 100;
const EXAM_NAMES = ["Round 1", "Round 2"];

async function findNinthBlue(academyId) {
  const ninth = await Class.findOne({
    academy: academyId,
    $or: [{ gradeLevel: 9 }, { name: /class\s*9|9th|\b9\b/i }],
  }).lean();
  if (!ninth) return null;
  const blue = await Section.findOne({
    academy: academyId,
    class: ninth._id,
    name: /^blue$/i,
  }).lean();
  if (!blue) return null;
  return { schoolClass: ninth, section: blue };
}

async function ensureExam(academyId, name) {
  let exam = await ExamTerm.findOne({
    academy: academyId,
    name,
    session: SESSION,
  });
  if (!exam) {
    exam = await ExamTerm.create({
      academy: academyId,
      name,
      session: SESSION,
      passPercent: 33,
      examDate: new Date(),
    });
  } else {
    exam.passPercent = 33;
    exam.examDate = new Date();
    await exam.save();
  }
  return exam;
}

async function seedExamMarks({ academy, section, students, exam, roundIndex }) {
  // Clear prior assessments for this section+exam so marks are fresh
  const old = await SubjectAssessment.find({
    academy: academy._id,
    examTerm: exam._id,
    section: section._id,
  })
    .select("_id")
    .lean();
  const oldIds = old.map((a) => a._id);
  if (oldIds.length) {
    await StudentMark.deleteMany({ assessment: { $in: oldIds } });
    await SubjectAssessment.deleteMany({ _id: { $in: oldIds } });
  }

  const enrollRows = await StudentSubject.find({
    student: { $in: students.map((s) => s._id) },
  })
    .select("student subject")
    .lean();

  let subjectIds = [...new Set(enrollRows.map((r) => String(r.subject)))];
  if (!subjectIds.length) {
    subjectIds = (
      await Subject.find({ isActive: true }).select("_id").limit(8).lean()
    ).map((s) => String(s._id));
  }

  const subjects = await Subject.find({ _id: { $in: subjectIds } })
    .select("name")
    .lean();

  const assessments = [];
  for (const subject of subjects) {
    const assessment = await SubjectAssessment.create({
      academy: academy._id,
      examTerm: exam._id,
      section: section._id,
      subject: subject._id,
      subjectName: subject.name,
      totalMarks: TOTAL_MARKS,
    });
    assessments.push(assessment);
  }

  const enrolled = new Map();
  for (const row of enrollRows) {
    const key = String(row.student);
    if (!enrolled.has(key)) enrolled.set(key, new Set());
    enrolled.get(key).add(String(row.subject));
  }

  let written = 0;
  for (const assessment of assessments) {
    const subjectId = String(assessment.subject);
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i];
      const list = enrolled.get(String(student._id));
      if (list && list.size > 0 && !list.has(subjectId)) continue;

      const roll =
        Number(String(student.rollNumber).replace(/\D/g, "")) || i + 1;
      // Different mark pattern per round so Round 1 ≠ Round 2
      const obtained = Math.min(
        TOTAL_MARKS,
        Math.max(
          40,
          ((roll * 7 + i * 3 + subjectId.length * 5 + roundIndex * 13) % 61) +
            40
        )
      );

      await StudentMark.create({
        academy: academy._id,
        assessment: assessment._id,
        student: student._id,
        obtainedMarks: obtained,
        isAbsent: false,
      });
      written += 1;
    }
  }

  return { subjects: assessments.length, marks: written };
}

async function seedAcademy(academy) {
  console.log(`\n${academy.name}`);
  const found = await findNinthBlue(academy._id);
  if (!found) {
    console.log("  skip: no Class 9 / Blue");
    return;
  }

  const { schoolClass, section } = found;
  const students = await Student.find({
    academy: academy._id,
    section: section._id,
    isActive: true,
  })
    .sort({ rollNumber: 1 })
    .lean();

  if (!students.length) {
    console.log("  skip: no students in Class 9 / Blue");
    return;
  }

  console.log(
    `  ${schoolClass.name}/${section.name}: ${students.length} students`
  );

  for (let i = 0; i < EXAM_NAMES.length; i += 1) {
    const name = EXAM_NAMES[i];
    const exam = await ensureExam(academy._id, name);
    const result = await seedExamMarks({
      academy,
      section,
      students,
      exam,
      roundIndex: i + 1,
    });
    console.log(
      `  ${name}: subjects=${result.subjects}, marks=${result.marks}, examId=${exam._id}`
    );
  }
  console.log(`  sectionId=${section._id}`);
}

const run = async () => {
  try {
    await connectDB();
    const academies = await Academy.find({}).sort({ name: 1 });
    for (const academy of academies) {
      await seedAcademy(academy);
    }
    console.log("\nDone.");
  } catch (error) {
    console.error("Failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
