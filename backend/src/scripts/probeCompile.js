import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import ExamTerm from "../models/ExamTerm.js";
import { currentAcademicSession } from "../utils/academicSession.js";

// Inline call of compile helpers via HTTP-less path: import controller internals? Instead duplicate load.
import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import StudentMark from "../models/StudentMark.js";
import AssessmentManualMark from "../models/AssessmentManualMark.js";
import {
  compileMultiRoundSectionResult,
  sortByRoll,
} from "../utils/resultHelpers.js";

await connectDB();
const academy = await Academy.findOne({ name: /Al Zain/i }).lean();
const klass = await Class.findOne({ academy: academy._id, gradeLevel: 9 }).lean();
const sections = await Section.find({
  academy: academy._id,
  class: klass._id,
  name: { $in: [/^blue$/i, /^red$/i] },
}).lean();
const exams = await ExamTerm.find({
  academy: academy._id,
  session: currentAcademicSession(),
  name: { $in: ["Round 1", "Round 2"] },
})
  .sort({ name: 1 })
  .lean();

console.log(
  "sections",
  sections.map((s) => s.name),
  "exams",
  exams.map((e) => e.name)
);

const compiledStudents = [];
const sectionByStudentId = new Map();
for (const section of sections) {
  const students = await Student.find({
    academy: academy._id,
    section: section._id,
    isActive: true,
  }).lean();
  const enrollRows = await StudentSubject.find({
    student: { $in: students.map((s) => s._id) },
  }).lean();
  const enroll = new Map();
  for (const row of enrollRows) {
    const key = String(row.student);
    if (!enroll.has(key)) enroll.set(key, []);
    enroll.get(key).push(String(row.subject));
  }
  for (const student of students) {
    const id = String(student._id);
    sectionByStudentId.set(id, section.name);
    compiledStudents.push({
      id,
      rollNumber: student.rollNumber,
      name: student.name,
      fatherName: student.fatherName,
      major: student.major,
      group: student.group,
      sectionName: section.name,
      enrolledSubjectIds: enroll.get(id) || [],
    });
  }
}

const rounds = [];
for (const exam of exams) {
  const bySubject = new Map();
  for (const section of sections) {
    const assessments = await SubjectAssessment.find({
      academy: academy._id,
      section: section._id,
      examTerm: exam._id,
    })
      .populate("subject", "name")
      .lean();
    const ids = assessments.map((a) => a._id);
    const marks = await StudentMark.find({ assessment: { $in: ids } }).lean();
    const byA = new Map();
    for (const m of marks) {
      const k = String(m.assessment);
      if (!byA.has(k)) byA.set(k, []);
      byA.get(k).push(m);
    }
    for (const a of assessments) {
      const sid = String(a.subject?._id || a.subject);
      const rows = byA.get(String(a._id)) || [];
      const existing = bySubject.get(sid);
      const packed = {
        subjectId: sid,
        subjectName: a.subject?.name || a.subjectName,
        totalMarks: Number(a.totalMarks),
        marks: rows.map((m) => ({
          studentId: String(m.student),
          obtainedMarks: m.obtainedMarks,
          isAbsent: m.isAbsent,
        })),
      };
      if (!existing) bySubject.set(sid, packed);
      else {
        existing.marks.push(...packed.marks);
        existing.totalMarks = Math.max(existing.totalMarks, packed.totalMarks);
      }
    }
  }
  rounds.push({
    id: String(exam._id),
    label: exam.name,
    assessments: [...bySubject.values()],
  });
}

const compiled = compileMultiRoundSectionResult({
  passPercent: 33,
  className: "Class 9",
  gradeLevel: 9,
  students: compiledStudents,
  rounds,
});

const sample = compiled.rows.slice(0, 3).map((r) => ({
  name: r.name,
  roll: r.rollNumber,
  position: r.position,
  obtainedTotal: r.obtainedTotal,
  maxTotal: r.maxTotal,
  percent: r.percent,
  grade: r.grade,
  complete: r.complete,
  breakdownLen: r.breakdown?.length,
  cols: compiled.columns.length,
  roundCells: r.breakdown?.flatMap((b) => b.roundValues.map((v) => v.display))
    .length,
}));
console.log(JSON.stringify({ colCount: compiled.columns.length, sample }, null, 2));
await mongoose.connection.close();
