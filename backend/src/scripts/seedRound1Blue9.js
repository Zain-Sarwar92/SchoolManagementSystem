/**
 * Create "Round 1" exam for Class 9 / Blue and fill marks for every student/subject.
 * Usage: node src/scripts/seedRound1Blue9.js
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

const EXAM_NAME = "Round 1";
const TOTAL_MARKS = 100;
const SESSION = currentAcademicSession();

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

async function subjectIdsForSection(academyId, sectionId) {
  const students = await Student.find({
    academy: academyId,
    section: sectionId,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!students.length) return [];
  const rows = await StudentSubject.find({
    student: { $in: students.map((s) => s._id) },
  })
    .select("subject")
    .lean();
  return [...new Set(rows.map((r) => String(r.subject)))];
}

async function seedAcademy(academy) {
  const found = await findNinthBlue(academy._id);
  if (!found) {
    console.log(`  skip: no Class 9 / Blue`);
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
    console.log(`  skip: ${schoolClass.name}/${section.name} has no students`);
    return;
  }

  let exam = await ExamTerm.findOne({
    academy: academy._id,
    name: EXAM_NAME,
    session: SESSION,
  });
  if (!exam) {
    exam = await ExamTerm.create({
      academy: academy._id,
      name: EXAM_NAME,
      session: SESSION,
      passPercent: 33,
      examDate: new Date(),
    });
  }

  let subjectIds = await subjectIdsForSection(academy._id, section._id);
  if (!subjectIds.length) {
    const all = await Subject.find({ isActive: true }).select("_id").limit(8).lean();
    subjectIds = all.map((s) => String(s._id));
  }

  const subjects = await Subject.find({ _id: { $in: subjectIds } })
    .select("name")
    .lean();

  for (const subject of subjects) {
    await SubjectAssessment.findOneAndUpdate(
      {
        academy: academy._id,
        examTerm: exam._id,
        section: section._id,
        subject: subject._id,
      },
      {
        academy: academy._id,
        examTerm: exam._id,
        section: section._id,
        subject: subject._id,
        subjectName: subject.name,
        totalMarks: TOTAL_MARKS,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const assessments = await SubjectAssessment.find({
    academy: academy._id,
    examTerm: exam._id,
    section: section._id,
  }).lean();

  const enroll = await StudentSubject.find({
    student: { $in: students.map((s) => s._id) },
  })
    .select("student subject")
    .lean();
  const enrolled = new Map();
  for (const row of enroll) {
    const key = String(row.student);
    if (!enrolled.has(key)) enrolled.set(key, new Set());
    enrolled.get(key).add(String(row.subject));
  }

  let marksWritten = 0;
  for (const assessment of assessments) {
    const subjectId = String(assessment.subject);
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i];
      const list = enrolled.get(String(student._id));
      // If student has enrollments, only mark enrolled subjects; else mark all
      if (list && list.size > 0 && !list.has(subjectId)) continue;

      const roll = Number(String(student.rollNumber).replace(/\D/g, "")) || i + 1;
      const obtained = Math.min(
        TOTAL_MARKS,
        Math.max(35, ((roll * 7 + i * 3 + subjectId.length * 5) % 66) + 35)
      );

      await StudentMark.findOneAndUpdate(
        { assessment: assessment._id, student: student._id },
        {
          academy: academy._id,
          assessment: assessment._id,
          student: student._id,
          obtainedMarks: obtained,
          isAbsent: false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      marksWritten += 1;
    }
  }

  console.log(
    `  ${schoolClass.name}/${section.name}: exam="${EXAM_NAME}" subjects=${assessments.length} students=${students.length} marks=${marksWritten}`
  );
  console.log(`  sectionId=${section._id} examId=${exam._id}`);
}

const run = async () => {
  try {
    await connectDB();
    const academies = await Academy.find({}).sort({ name: 1 });
    for (const academy of academies) {
      console.log(`\n${academy.name}`);
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
