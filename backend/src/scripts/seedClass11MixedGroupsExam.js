/**
 * Class 11:
 *  - Blue: pre_medical + pre_engineering + ics
 *  - Red:  pre_engineering + ics
 * Then create Round 1 exam + fill marks for those sections.
 *
 * Does NOT delete Class 9/10 students.
 *
 * Usage: node src/scripts/seedClass11MixedGroupsExam.js
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
const EXAM_NAME = "Round 1";
const TOTAL_MARKS = 100;
const PER_GROUP = 6;

const FIRST = [
  "Ahmed",
  "Ali",
  "Hassan",
  "Usman",
  "Hamza",
  "Omar",
  "Bilal",
  "Zain",
  "Sara",
  "Noor",
  "Ayesha",
  "Maryam",
  "Fatima",
  "Hira",
  "Sana",
  "Iqra",
  "Danish",
  "Farhan",
];
const LAST = [
  "Khan",
  "Malik",
  "Raza",
  "Qureshi",
  "Bhatti",
  "Shah",
  "Mirza",
  "Hashmi",
  "Nawaz",
  "Ahmed",
  "Siddiqui",
  "Iqbal",
  "Hussain",
  "Sheikh",
  "Butt",
  "Chaudhry",
  "Ansari",
  "Baig",
];
const FATHER = [
  "Muhammad",
  "Saeed",
  "Imran",
  "Faisal",
  "Adnan",
  "Khalid",
  "Waqar",
  "Rashid",
  "Jameel",
  "Tariq",
  "Nadeem",
  "Asif",
  "Yasir",
  "Kamran",
  "Shahid",
  "Naveed",
  "Babar",
  "Javed",
];

const SECTION_PLANS = [
  {
    sectionName: /^blue$/i,
    label: "Blue",
    groups: ["pre_medical", "pre_engineering", "ics"],
    startRoll: 3101,
  },
  {
    sectionName: /^red$/i,
    label: "Red",
    groups: ["pre_engineering", "ics"],
    startRoll: 3201,
  },
];

async function findClass11(academyId) {
  return Class.findOne({
    academy: academyId,
    $or: [{ gradeLevel: 11 }, { name: /class\s*11|11th|\b11\b/i }],
  }).lean();
}

async function clearClass11Students(academyId, classId) {
  const students = await Student.find({
    academy: academyId,
    class: classId,
  })
    .select("_id")
    .lean();
  const ids = students.map((s) => s._id);
  if (!ids.length) {
    console.log("  no existing Class 11 students to clear");
    return;
  }

  await Promise.all([
    FeePaymentAllocation.deleteMany({ student: { $in: ids } }),
    FeePayment.deleteMany({ student: { $in: ids } }),
    FeeCharge.deleteMany({ student: { $in: ids } }),
    StudentMark.deleteMany({ student: { $in: ids } }),
    StudentSubject.deleteMany({ student: { $in: ids } }),
    Student.deleteMany({ _id: { $in: ids } }),
  ]);
  console.log(`  cleared ${ids.length} Class 11 student(s)`);
}

async function seedSection({
  academy,
  schoolClass,
  section,
  groups,
  startRoll,
  nameOffset,
}) {
  const docs = [];
  let roll = startRoll;
  let nameIndex = nameOffset;
  const gradeLevel = 11;

  for (const group of groups) {
    for (let i = 0; i < PER_GROUP; i += 1) {
      const tag =
        group === "pre_medical"
          ? "PM"
          : group === "pre_engineering"
            ? "PE"
            : "ICS";
      docs.push({
        name: `${FIRST[nameIndex % FIRST.length]} ${LAST[nameIndex % LAST.length]} ${tag}11`,
        fatherName: `${FATHER[nameIndex % FATHER.length]} ${LAST[(nameIndex + 3) % LAST.length]} ${roll}`,
        phone: `0301${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0322${String(2000000 + roll).slice(-7)}`,
        email: "",
        gender: nameIndex % 3 === 2 ? "female" : "male",
        dateOfBirth: new Date(2008, i % 12, 4 + (i % 20)),
        address: "Lahore",
        admissionDate: new Date(),
        monthlyFee: 6000,
        rollNumber: String(roll),
        session: SESSION,
        academy: academy._id,
        class: schoolClass._id,
        section: section._id,
        major: "science",
        group,
        gradeLevel,
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
    gradeLevel,
    students: created.map((s) => ({
      _id: s._id,
      group: s.group,
      major: s.major,
    })),
  });

  const counts = Object.fromEntries(
    groups.map((g) => [g, created.filter((s) => s.group === g).length])
  );
  console.log(
    `  ${schoolClass.name}/${section.name}: ${created.length} students`,
    counts,
    `rolls ${startRoll}–${roll - 1}`
  );

  return { section, students: created, schoolClass };
}

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

async function seedExamAndMarks(academy, bundles, exam) {
  let totalMarks = 0;

  for (const bundle of bundles) {
    const { section, students } = bundle;

    // Drop old assessments for this section+exam (clean reseed)
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
        await Subject.find({ isActive: true }).select("_id").limit(10).lean()
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
        const obtained = Math.min(
          TOTAL_MARKS,
          Math.max(
            40,
            ((roll * 8 + i * 5 + subjectId.length * 4 + 11) % 61) + 40
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

    totalMarks += written;
    console.log(
      `  exam ${EXAM_NAME} → ${bundle.schoolClass.name}/${section.name}: subjects=${assessments.length}, marks=${written}`
    );
  }

  return totalMarks;
}

async function seedAcademy(academy) {
  console.log(`\n${academy.name}`);
  const schoolClass = await findClass11(academy._id);
  if (!schoolClass) {
    console.log("  skip: no Class 11");
    return { students: 0, marks: 0 };
  }

  await clearClass11Students(academy._id, schoolClass._id);

  const bundles = [];
  let nameOffset = 0;

  for (const plan of SECTION_PLANS) {
    const section = await Section.findOne({
      academy: academy._id,
      class: schoolClass._id,
      name: plan.sectionName,
    }).lean();
    if (!section) {
      console.log(`  skip: section ${plan.label} not found`);
      continue;
    }
    const bundle = await seedSection({
      academy,
      schoolClass,
      section,
      groups: plan.groups,
      startRoll: plan.startRoll,
      nameOffset,
    });
    nameOffset += plan.groups.length * PER_GROUP;
    bundles.push(bundle);
  }

  if (!bundles.length) return { students: 0, marks: 0 };

  const exam = await ensureExam(academy._id);
  const marks = await seedExamAndMarks(academy, bundles, exam);
  console.log(`  examId=${exam._id}`);

  return {
    students: bundles.reduce((n, b) => n + b.students.length, 0),
    marks,
  };
}

const run = async () => {
  try {
    await connectDB();
    const academies = await Academy.find({}).sort({ name: 1 });
    let totals = { students: 0, marks: 0 };
    for (const academy of academies) {
      const result = await seedAcademy(academy);
      totals.students += result.students;
      totals.marks += result.marks;
    }
    console.log("\nDone:", totals, `· session ${SESSION} · exam "${EXAM_NAME}"`);
  } catch (error) {
    console.error("Failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
