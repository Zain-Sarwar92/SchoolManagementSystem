/**
 * Seed EVERY Class 9 section with bio+computer students,
 * create Round 1 exam and fill marks (for separate section print).
 *
 * Usage: node src/scripts/seedAllClass9Round1.js
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
const EXAM_NAME = "Round 1";
const TOTAL = 100;
const PER_GROUP = 6;
const GROUPS = ["biology", "computer"];

const FIRST = [
  "Ahmed", "Ali", "Hassan", "Usman", "Hamza", "Omar", "Bilal", "Zain",
  "Sara", "Noor", "Ayesha", "Maryam", "Fatima", "Hira", "Sana", "Iqra",
  "Rehan", "Talha", "Kashif", "Saad", "Waleed", "Arham", "Maham", "Zara",
];
const LAST = [
  "Khan", "Malik", "Raza", "Qureshi", "Bhatti", "Shah", "Mirza", "Hashmi",
  "Nawaz", "Ahmed", "Siddiqui", "Iqbal", "Hussain", "Sheikh", "Butt", "Chaudhry",
  "Awan", "Gill", "Dar", "Bajwa", "Mughal", "Raja", "Farooq", "Anwar",
];
const FATHER = [
  "Muhammad", "Saeed", "Imran", "Faisal", "Adnan", "Khalid", "Waqar", "Rashid",
  "Jameel", "Tariq", "Nadeem", "Asif", "Yasir", "Kamran", "Shahid", "Naveed",
  "Gulzar", "Iftikhar", "Shakeel", "Amjad", "Rizwan", "Tanveer", "Mushtaq", "Zaheer",
];

async function nextFreeRoll(academyId, preferred) {
  let roll = preferred;
  for (let guard = 0; guard < 5000; guard += 1) {
    const exists = await Student.exists({
      academy: academyId,
      session: SESSION,
      rollNumber: String(roll),
    });
    if (!exists) return roll;
    roll += 1;
  }
  throw new Error("Could not find free roll number");
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

async function clearSection(academyId, sectionId) {
  const old = await Student.find({ academy: academyId, section: sectionId })
    .select("_id")
    .lean();
  const ids = old.map((s) => s._id);
  const assess = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
  })
    .select("_id")
    .lean();
  const aIds = assess.map((a) => a._id);
  await Promise.all([
    ids.length
      ? StudentMark.deleteMany({
          $or: [
            { student: { $in: ids } },
            ...(aIds.length ? [{ assessment: { $in: aIds } }] : []),
          ],
        })
      : aIds.length
        ? StudentMark.deleteMany({ assessment: { $in: aIds } })
        : Promise.resolve(),
    ids.length
      ? StudentSubject.deleteMany({ student: { $in: ids } })
      : Promise.resolve(),
    aIds.length
      ? SubjectAssessment.deleteMany({ _id: { $in: aIds } })
      : Promise.resolve(),
    ids.length ? Student.deleteMany({ _id: { $in: ids } }) : Promise.resolve(),
  ]);
}

async function seedSection({
  academy,
  klass,
  section,
  exam,
  nameOffset,
  startRoll,
}) {
  await clearSection(academy._id, section._id);

  const docs = [];
  let roll = startRoll;
  let idx = nameOffset;

  for (const group of GROUPS) {
    for (let g = 0; g < PER_GROUP; g += 1) {
      roll = await nextFreeRoll(academy._id, roll);
      const tag = group === "biology" ? "Bio" : "Comp";
      const secTag = String(section.name).replace(/\s+/g, "").slice(0, 6);
      docs.push({
        name: `${FIRST[idx % FIRST.length]} ${LAST[idx % LAST.length]} ${tag}${secTag}`,
        fatherName: `${FATHER[idx % FATHER.length]} ${LAST[(idx + 2) % LAST.length]} ${roll}`,
        phone: `0300${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0321${String(2000000 + roll).slice(-7)}`,
        gender: idx % 3 === 2 ? "female" : "male",
        dateOfBirth: new Date(2011, g % 12, 4 + g),
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
      idx += 1;
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
          ((rollNum * 6 + si * 4 + subjectId.length * 3 + startRoll) % 61) + 40
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

  const rolls = students.map((s) => Number(s.rollNumber)).filter(Boolean);
  const lo = rolls.length ? Math.min(...rolls) : startRoll;
  const hi = rolls.length ? Math.max(...rolls) : startRoll;
  console.log(
    `  ${section.name}: students=${students.length} rolls ${lo}–${hi} · subjects=${subjects.length} · marks=${marks}`
  );
  return { count: docs.length, nextRoll: roll };
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

  // Clear every Class 9 section first so rolls stay unique academy-wide
  for (const section of sections) {
    await clearSection(academy._id, section._id);
  }

  const exam = await ensureExam(academy._id);
  console.log(`  exam=${EXAM_NAME} (${exam._id}) · sections=${sections.length}`);

  let nameOffset = 0;
  let nextRoll = 1101;
  for (const section of sections) {
    const result = await seedSection({
      academy,
      klass,
      section,
      exam,
      nameOffset,
      startRoll: nextRoll,
    });
    nameOffset += result.count;
    nextRoll = result.nextRoll;
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
