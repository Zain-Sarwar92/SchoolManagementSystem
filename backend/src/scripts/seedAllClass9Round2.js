/**
 * Add Round 2 marks for EVERY Class 9 section (keeps existing students + Round 1).
 *
 * Usage: node src/scripts/seedAllClass9Round2.js
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
import StudentMark from "../models/StudentMark.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const EXAM_NAME = "Round 2";
const TOTAL = 100;

async function ensureExam(academyId) {
  let exam = await ExamTerm.findOne({
    academy: academyId,
    name: EXAM_NAME,
    session: SESSION,
  });
  if (!exam) {
    exam = await ExamTerm.create({
      academy: academyId,
      name: EXAM_NAME,
      session: SESSION,
      passPercent: 33,
      examDate: new Date(),
    });
  }
  return exam;
}

async function clearRoundForSection(academyId, sectionId, examId) {
  const assess = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .select("_id")
    .lean();
  const aIds = assess.map((a) => a._id);
  if (!aIds.length) return;
  await StudentMark.deleteMany({ assessment: { $in: aIds } });
  await SubjectAssessment.deleteMany({ _id: { $in: aIds } });
}

async function seedSection({ academy, section, exam }) {
  const students = await Student.find({
    academy: academy._id,
    section: section._id,
    isActive: { $ne: false },
  })
    .select("_id rollNumber")
    .lean();

  if (!students.length) {
    console.log(`  ${section.name}: skip (no students)`);
    return;
  }

  await clearRoundForSection(academy._id, section._id, exam._id);

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
  const enrolled = new Map();
  for (const row of enrollRows) {
    const key = String(row.student);
    if (!enrolled.has(key)) enrolled.set(key, new Set());
    enrolled.get(key).add(String(row.subject));
  }

  let marks = 0;
  for (const subject of subjects) {
    const assessment = await SubjectAssessment.create({
      academy: academy._id,
      examTerm: exam._id,
      section: section._id,
      subject: subject._id,
      subjectName: subject.name,
      totalMarks: TOTAL,
    });
    const subjectId = String(subject._id);
    for (let si = 0; si < students.length; si += 1) {
      const student = students[si];
      const list = enrolled.get(String(student._id));
      if (list && list.size > 0 && !list.has(subjectId)) continue;
      const rollNum =
        Number(String(student.rollNumber).replace(/\D/g, "")) || si + 1;
      const obtained = Math.min(
        TOTAL,
        Math.max(
          40,
          ((rollNum * 7 + si * 3 + subjectId.length * 5 + 26) % 61) + 40
        )
      );
      await StudentMark.create({
        academy: academy._id,
        assessment: assessment._id,
        student: student._id,
        obtainedMarks: obtained,
        isAbsent: false,
      });
      marks += 1;
    }
  }

  console.log(
    `  ${section.name}: students=${students.length} · subjects=${subjects.length} · marks=${marks}`
  );
}

async function seedAcademy(academy) {
  console.log(`\n${academy.name}`);
  const klass = await Class.findOne({
    academy: academy._id,
    $or: [{ gradeLevel: 9 }, { name: /class\s*9|9th|\b9\b/i }],
  }).lean();
  if (!klass) {
    console.log("  skip: no Class 9");
    return;
  }

  const sections = await Section.find({
    academy: academy._id,
    class: klass._id,
    isActive: { $ne: false },
  })
    .sort({ name: 1 })
    .lean();
  if (!sections.length) {
    console.log("  skip: no sections");
    return;
  }

  const exam = await ensureExam(academy._id);
  console.log(`  exam=${EXAM_NAME} (${exam._id}) · sections=${sections.length}`);

  for (const section of sections) {
    await seedSection({ academy, section, exam });
  }
}

const run = async () => {
  try {
    await connectDB();
    for (const academy of await Academy.find({}).sort({ name: 1 })) {
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
