/**
 * Fill marks for every section already linked to exam "Round 3".
 * Usage: node src/scripts/seedRound3Marks.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import StudentMark from "../models/StudentMark.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

void Section;
void Subject;

dotenv.config();

const SESSION = currentAcademicSession();
const EXAM_NAME = "Round 3";
const TOTAL = 100;

async function seedExam(academy, exam) {
  const assessments = await SubjectAssessment.find({
    academy: academy._id,
    examTerm: exam._id,
  })
    .populate("section", "name")
    .populate("subject", "name")
    .lean();

  if (!assessments.length) {
    console.log("  skip: no sections linked to this exam yet");
    return;
  }

  const bySection = new Map();
  for (const a of assessments) {
    const sid = String(a.section?._id || a.section);
    if (!bySection.has(sid)) {
      bySection.set(sid, {
        name: a.section?.name || sid,
        assessments: [],
      });
    }
    bySection.get(sid).assessments.push(a);
  }

  console.log(`  exam=${exam.name} · sections=${bySection.size}`);

  for (const [sectionId, bucket] of bySection) {
    const students = await Student.find({
      academy: academy._id,
      section: sectionId,
      isActive: { $ne: false },
    })
      .select("_id rollNumber")
      .lean();

    if (!students.length) {
      console.log(`  ${bucket.name}: skip (no students)`);
      continue;
    }

    const enrollRows = await StudentSubject.find({
      student: { $in: students.map((s) => s._id) },
    })
      .select("student subject")
      .lean();
    const enrolled = new Map();
    for (const row of enrollRows) {
      const key = String(row.student);
      if (!enrolled.has(key)) enrolled.set(key, new Set());
      enrolled.get(key).add(String(row.subject));
    }

    let marks = 0;
    for (const assessment of bucket.assessments) {
      const aId = assessment._id;
      await StudentMark.deleteMany({ assessment: aId });

      // Ensure totalMarks is set
      if (!assessment.totalMarks) {
        await SubjectAssessment.updateOne(
          { _id: aId },
          { $set: { totalMarks: TOTAL } }
        );
      }

      const subjectId = String(assessment.subject?._id || assessment.subject);
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
            ((rollNum * 5 + si * 7 + subjectId.length * 4 + 39) % 61) + 40
          )
        );
        await StudentMark.create({
          academy: academy._id,
          assessment: aId,
          student: student._id,
          obtainedMarks: obtained,
          isAbsent: false,
        });
        marks += 1;
      }
    }

    console.log(
      `  ${bucket.name}: students=${students.length} · subjects=${bucket.assessments.length} · marks=${marks}`
    );
  }
}

const run = async () => {
  try {
    await connectDB();
    for (const academy of await Academy.find({}).sort({ name: 1 })) {
      console.log(`\n${academy.name}`);
      const exam = await ExamTerm.findOne({
        academy: academy._id,
        name: EXAM_NAME,
        session: SESSION,
      }).lean();
      if (!exam) {
        // try name match without strict session
        const any = await ExamTerm.findOne({
          academy: academy._id,
          name: new RegExp(`^${EXAM_NAME}$`, "i"),
        }).lean();
        if (!any) {
          console.log(`  skip: no "${EXAM_NAME}" exam`);
          continue;
        }
        await seedExam(academy, any);
        continue;
      }
      await seedExam(academy, exam);
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
