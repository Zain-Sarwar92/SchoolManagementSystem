/**
 * Seed Class 9 / Blue (bio + computer), Round 1 + Round 2 with marks.
 * Usage: node src/scripts/seedNineBlueRounds.js
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
import { syncManyStudentSubjects } from "../utils/studentEnrollment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const TOTAL = 100;
const PER_GROUP = 8;
const START_ROLL = 1101;
const EXAMS = ["Round 1", "Round 2"];

const FIRST = [
  "Ahmed", "Ali", "Hassan", "Usman", "Hamza", "Omar", "Bilal", "Zain",
  "Sara", "Noor", "Ayesha", "Maryam", "Fatima", "Hira", "Sana", "Iqra",
];
const LAST = [
  "Khan", "Malik", "Raza", "Qureshi", "Bhatti", "Shah", "Mirza", "Hashmi",
  "Nawaz", "Ahmed", "Siddiqui", "Iqbal", "Hussain", "Sheikh", "Butt", "Chaudhry",
];
const FATHER = [
  "Muhammad", "Saeed", "Imran", "Faisal", "Adnan", "Khalid", "Waqar", "Rashid",
  "Jameel", "Tariq", "Nadeem", "Asif", "Yasir", "Kamran", "Shahid", "Naveed",
];

async function findBlue9(academyId) {
  const klass = await Class.findOne({
    academy: academyId,
    $or: [{ gradeLevel: 9 }, { name: /class\s*9|9th|\b9\b/i }],
  }).lean();
  if (!klass) return null;
  const section = await Section.findOne({
    academy: academyId,
    class: klass._id,
    name: /^blue$/i,
  }).lean();
  if (!section) return null;
  return { klass, section };
}

async function ensureExam(academyId, name) {
  let exam = await ExamTerm.findOne({ academy: academyId, name, session: SESSION });
  if (!exam) {
    exam = await ExamTerm.create({
      academy: academyId,
      name,
      session: SESSION,
      passPercent: 33,
      examDate: new Date(),
    });
  }
  return exam;
}

async function seedAcademy(academy) {
  console.log(`\n${academy.name}`);
  const found = await findBlue9(academy._id);
  if (!found) {
    console.log("  skip: no Class 9 / Blue");
    return;
  }
  const { klass, section } = found;

  // Replace only this section's students
  const old = await Student.find({ academy: academy._id, section: section._id })
    .select("_id")
    .lean();
  const oldIds = old.map((s) => s._id);
  if (oldIds.length) {
    const oldAssess = await SubjectAssessment.find({
      academy: academy._id,
      section: section._id,
    })
      .select("_id")
      .lean();
    const aIds = oldAssess.map((a) => a._id);
    await Promise.all([
      StudentMark.deleteMany({
        $or: [
          { student: { $in: oldIds } },
          ...(aIds.length ? [{ assessment: { $in: aIds } }] : []),
        ],
      }),
      StudentSubject.deleteMany({ student: { $in: oldIds } }),
      aIds.length
        ? SubjectAssessment.deleteMany({ _id: { $in: aIds } })
        : Promise.resolve(),
      Student.deleteMany({ _id: { $in: oldIds } }),
    ]);
    console.log(`  cleared ${oldIds.length} old Blue students`);
  }

  const docs = [];
  let roll = START_ROLL;
  let i = 0;
  for (const group of ["biology", "computer"]) {
    for (let g = 0; g < PER_GROUP; g += 1) {
      const tag = group === "biology" ? "Bio" : "Comp";
      docs.push({
        name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]} ${tag}`,
        fatherName: `${FATHER[i % FATHER.length]} ${LAST[(i + 3) % LAST.length]} ${roll}`,
        phone: `0300${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0321${String(2000000 + roll).slice(-7)}`,
        gender: i % 3 === 2 ? "female" : "male",
        dateOfBirth: new Date(2011, g % 12, 5 + g),
        address: "Lahore",
        admissionDate: new Date(),
        monthlyFee: 5000,
        rollNumber: String(roll),
        session: SESSION,
        academy: academy._id,
        class: klass._id,
        section: section._id,
        major: "science",
        group,
        gradeLevel: 9,
        isActive: true,
      });
      roll += 1;
      i += 1;
    }
  }

  const students = await Student.insertMany(docs);
  await syncManyStudentSubjects({
    academyId: academy._id,
    classId: klass._id,
    gradeLevel: 9,
    students: students.map((s) => ({
      _id: s._id,
      group: s.group,
      major: s.major,
    })),
  });
  console.log(
    `  ${klass.name}/${section.name}: ${students.length} students (rolls ${START_ROLL}–${roll - 1})`
  );

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

  for (let r = 0; r < EXAMS.length; r += 1) {
    const exam = await ensureExam(academy._id, EXAMS[r]);
    const oldAssess = await SubjectAssessment.find({
      academy: academy._id,
      examTerm: exam._id,
      section: section._id,
    })
      .select("_id")
      .lean();
    const aIds = oldAssess.map((a) => a._id);
    if (aIds.length) {
      await StudentMark.deleteMany({ assessment: { $in: aIds } });
      await SubjectAssessment.deleteMany({ _id: { $in: aIds } });
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
            ((rollNum * 7 + si * 3 + subjectId.length * 5 + (r + 1) * 13) % 61) +
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
        marks += 1;
      }
    }
    console.log(
      `  ${EXAMS[r]}: subjects=${subjects.length}, marks=${marks}, examId=${exam._id}`
    );
  }
  console.log(`  sectionId=${section._id}`);
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
