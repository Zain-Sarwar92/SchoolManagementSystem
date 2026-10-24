/**
 * 1) Delete all students (+ related)
 * 2) Seed Class 9 & 10 Blue with biology + computer students
 * 3) Create "Round 1" exam for those sections
 * 4) Fill marks
 *
 * Usage: node src/scripts/seedBioComputerBlueExam.js
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
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import AssessmentManualMark from "../models/AssessmentManualMark.js";
import { syncManyStudentSubjects } from "../utils/studentEnrollment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const EXAM_NAME = "Round 1";
const TOTAL_MARKS = 100;
/** Students per group (biology / computer) in each Blue section */
const PER_GROUP = 8;

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
];

async function clearAllStudents() {
  const [alloc, pays, charges, marks, manuals, subjects, students] =
    await Promise.all([
      FeePaymentAllocation.deleteMany({}),
      FeePayment.deleteMany({}),
      FeeCharge.deleteMany({}),
      StudentMark.deleteMany({}),
      AssessmentManualMark.deleteMany({}),
      StudentSubject.deleteMany({}),
      Student.deleteMany({}),
    ]);
  // Clear assessments so exam reseed is clean (keep ExamTerm names optional)
  const assessments = await SubjectAssessment.deleteMany({});
  console.log(
    `Cleared students=${students.deletedCount}, subjects=${subjects.deletedCount}, marks=${marks.deletedCount}, manuals=${manuals.deletedCount}, assessments=${assessments.deletedCount}, fees charges/payments/alloc=${charges.deletedCount}/${pays.deletedCount}/${alloc.deletedCount}`
  );
}

async function findBlue(academyId, gradeLevel) {
  const schoolClass = await Class.findOne({
    academy: academyId,
    $or: [
      { gradeLevel },
      {
        name: new RegExp(
          `class\\s*${gradeLevel}|${gradeLevel}th|\\b${gradeLevel}\\b`,
          "i"
        ),
      },
    ],
  }).lean();
  if (!schoolClass) return null;
  const section = await Section.findOne({
    academy: academyId,
    class: schoolClass._id,
    name: /^blue$/i,
  }).lean();
  if (!section) return null;
  return { schoolClass, section, gradeLevel: Number(schoolClass.gradeLevel) || gradeLevel };
}

async function seedBlueSection({
  academy,
  schoolClass,
  section,
  gradeLevel,
  startRoll,
  nameOffset = 0,
}) {
  const groups = ["biology", "computer"];
  const docs = [];
  let roll = startRoll;
  let nameIndex = nameOffset;

  for (const group of groups) {
    for (let i = 0; i < PER_GROUP; i += 1) {
      const gender = nameIndex % 3 === 2 ? "female" : "male";
      const groupTag = group === "biology" ? "Bio" : "Comp";
      // Unique per academy+session (name+father index)
      const name = `${FIRST[nameIndex % FIRST.length]} ${LAST[nameIndex % LAST.length]} ${groupTag}${gradeLevel}`;
      const fatherName = `${FATHER[nameIndex % FATHER.length]} ${LAST[(nameIndex + 4) % LAST.length]} ${roll}`;
      docs.push({
        name,
        fatherName,
        phone: `0300${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0321${String(2000000 + roll).slice(-7)}`,
        email: "",
        gender,
        dateOfBirth: new Date(gradeLevel === 9 ? 2011 : 2010, i % 12, 5 + (i % 20)),
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

  const bio = created.filter((s) => s.group === "biology").length;
  const comp = created.filter((s) => s.group === "computer").length;
  console.log(
    `  ${schoolClass.name}/${section.name}: ${created.length} students (bio=${bio}, computer=${comp}) rolls ${startRoll}–${roll - 1}`
  );

  return { section, students: created, schoolClass, gradeLevel };
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
  } else {
    exam.passPercent = 33;
    exam.examDate = new Date();
    await exam.save();
  }
  return exam;
}

async function seedExamAndMarks(academy, sectionBundles, exam) {
  let totalMarks = 0;

  for (const bundle of sectionBundles) {
    const { section, students, gradeLevel } = bundle;

    // Unique subjects from enrollments for this section's students
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
      const assessment = await SubjectAssessment.findOneAndUpdate(
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
            35,
            ((roll * 9 + i * 4 + subjectId.length * 3 + gradeLevel) % 66) + 35
          )
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
  const targets = [];
  for (const grade of [9, 10]) {
    const found = await findBlue(academy._id, grade);
    if (!found) {
      console.log(`  skip Class ${grade} / Blue (not found)`);
      continue;
    }
    targets.push(found);
  }
  if (!targets.length) return { students: 0, marks: 0 };

  const bundles = [];
  // 9 Blue: 1101+, 10 Blue: 2101+
  let nameOffset = 0;
  for (const t of targets) {
    const startRoll = t.gradeLevel === 9 ? 1101 : 2101;
    const bundle = await seedBlueSection({
      academy,
      schoolClass: t.schoolClass,
      section: t.section,
      gradeLevel: t.gradeLevel,
      startRoll,
      nameOffset,
    });
    nameOffset += PER_GROUP * 2;
    bundles.push(bundle);
  }

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
    await clearAllStudents();

    // Also remove old Round 1 exams so recreate is clean? Keep exams, assessments already cleared.
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
