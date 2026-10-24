/**
 * Seed Class 9 / Red with biology + computer students,
 * create Round 1 + Round 2, fill marks.
 *
 * Usage: node src/scripts/seedNineRedExam.js
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
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import { syncManyStudentSubjects } from "../utils/studentEnrollment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const TOTAL_MARKS = 100;
const PER_GROUP = 8;
const START_ROLL = 1301;
const EXAM_NAMES = ["Round 1", "Round 2"];
const GROUPS = ["biology", "computer"];

const FIRST = [
  "Rehan",
  "Talha",
  "Yousaf",
  "Kashif",
  "Noman",
  "Saad",
  "Waleed",
  "Arham",
  "Maham",
  "Zara",
  "Laiba",
  "Eman",
  "Rida",
  "Amina",
  "Hania",
  "Mehak",
];
const LAST = [
  "Awan",
  "Gill",
  "Dar",
  "Bajwa",
  "Mughal",
  "Raja",
  "Sohail",
  "Farooq",
  "Anwar",
  "Javed",
  "Akhtar",
  "Yasin",
  "Saleem",
  "Parvez",
  "Abbas",
  "Rafiq",
];
const FATHER = [
  "Gulzar",
  "Iftikhar",
  "Shakeel",
  "Amjad",
  "Rizwan",
  "Tanveer",
  "Sohail",
  "Pervaiz",
  "Mushtaq",
  "Zaheer",
  "Arif",
  "Naeem",
  "Iqbal",
  "Shafiq",
  "Hameed",
  "Azhar",
];

async function findNinthRed(academyId) {
  const ninth = await Class.findOne({
    academy: academyId,
    $or: [{ gradeLevel: 9 }, { name: /class\s*9|9th|\b9\b/i }],
  }).lean();
  if (!ninth) return null;
  const red = await Section.findOne({
    academy: academyId,
    class: ninth._id,
    name: /^red$/i,
  }).lean();
  if (!red) return null;
  return { schoolClass: ninth, section: red };
}

async function clearSectionStudents(academyId, sectionId) {
  const students = await Student.find({
    academy: academyId,
    section: sectionId,
  })
    .select("_id")
    .lean();
  const ids = students.map((s) => s._id);
  if (!ids.length) return 0;

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
  })
    .select("_id")
    .lean();
  const assessmentIds = assessments.map((a) => a._id);

  await Promise.all([
    FeePaymentAllocation.deleteMany({ student: { $in: ids } }),
    FeePayment.deleteMany({ student: { $in: ids } }),
    FeeCharge.deleteMany({ student: { $in: ids } }),
    StudentMark.deleteMany({
      $or: [
        { student: { $in: ids } },
        ...(assessmentIds.length
          ? [{ assessment: { $in: assessmentIds } }]
          : []),
      ],
    }),
    StudentSubject.deleteMany({ student: { $in: ids } }),
    assessmentIds.length
      ? SubjectAssessment.deleteMany({ _id: { $in: assessmentIds } })
      : Promise.resolve(),
    Student.deleteMany({ _id: { $in: ids } }),
  ]);
  return ids.length;
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
  }
  return exam;
}

async function seedStudents(academy, schoolClass, section) {
  const docs = [];
  let roll = START_ROLL;
  let nameIndex = 0;

  for (const group of GROUPS) {
    for (let i = 0; i < PER_GROUP; i += 1) {
      const tag = group === "biology" ? "Bio" : "Comp";
      docs.push({
        name: `${FIRST[nameIndex % FIRST.length]} ${LAST[nameIndex % LAST.length]} ${tag}9R`,
        fatherName: `${FATHER[nameIndex % FATHER.length]} ${LAST[(nameIndex + 2) % LAST.length]} ${roll}`,
        phone: `0303${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0323${String(2000000 + roll).slice(-7)}`,
        email: "",
        gender: nameIndex % 3 === 2 ? "female" : "male",
        dateOfBirth: new Date(2011, i % 12, 3 + (i % 20)),
        address: "Lahore",
        admissionDate: new Date(),
        monthlyFee: 5000,
        rollNumber: String(roll),
        session: SESSION,
        academy: academy._id,
        class: schoolClass._id,
        section: section._id,
        major: "science",
        group,
        gradeLevel: 9,
        isActive: true,
      });
      roll += 1;
      nameIndex += 1;
    }
  }

  const created = await Student.insertMany(docs);
  await syncManyStudentSubjects({
    academyId: academy._id,
    classId: schoolClass._id,
    gradeLevel: 9,
    students: created.map((s) => ({
      _id: s._id,
      group: s.group,
      major: s.major,
    })),
  });

  console.log(
    `  students: ${created.length} (bio=${PER_GROUP}, computer=${PER_GROUP}) rolls ${START_ROLL}–${roll - 1}`
  );
  return created;
}

async function seedExamMarks({ academy, section, students, exam, roundIndex }) {
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
    assessments.push(
      await SubjectAssessment.create({
        academy: academy._id,
        examTerm: exam._id,
        section: section._id,
        subject: subject._id,
        subjectName: subject.name,
        totalMarks: TOTAL_MARKS,
      })
    );
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
      const obtained = Math.min(
        TOTAL_MARKS,
        Math.max(
          40,
          ((roll * 5 + i * 7 + subjectId.length * 4 + roundIndex * 11) % 61) +
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
  const found = await findNinthRed(academy._id);
  if (!found) {
    console.log("  skip: no Class 9 / Red");
    return;
  }

  const { schoolClass, section } = found;
  const cleared = await clearSectionStudents(academy._id, section._id);
  if (cleared) console.log(`  cleared ${cleared} old Red student(s)`);

  const students = await seedStudents(academy, schoolClass, section);

  for (let i = 0; i < EXAM_NAMES.length; i += 1) {
    const exam = await ensureExam(academy._id, EXAM_NAMES[i]);
    const result = await seedExamMarks({
      academy,
      section,
      students,
      exam,
      roundIndex: i + 1,
    });
    console.log(
      `  ${EXAM_NAMES[i]}: subjects=${result.subjects}, marks=${result.marks}, examId=${exam._id}`
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
