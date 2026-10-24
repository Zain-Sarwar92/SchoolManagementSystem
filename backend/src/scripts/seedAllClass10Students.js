/**
 * Seed EVERY Class 10 section with bio+computer students (no exams/marks).
 *
 * Usage: node src/scripts/seedAllClass10Students.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import StudentMark from "../models/StudentMark.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import { syncManyStudentSubjects } from "../utils/studentEnrollment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const PER_GROUP = 6;
const GROUPS = ["biology", "computer"];
const START_ROLL = 2101;

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

async function seedSection({ academy, klass, section, nameOffset, startRoll }) {
  const docs = [];
  let roll = startRoll;
  let idx = nameOffset;

  for (const group of GROUPS) {
    for (let g = 0; g < PER_GROUP; g += 1) {
      roll = await nextFreeRoll(academy._id, roll);
      // Unique name+father per academy/session index; print UI strips trailing roll from father
      docs.push({
        name: `${FIRST[idx % FIRST.length]} ${LAST[(idx + Math.floor(idx / FIRST.length)) % LAST.length]}`,
        fatherName: `${FATHER[idx % FATHER.length]} ${LAST[(idx + 3) % LAST.length]} ${roll}`,
        phone: `0301${String(1000000 + roll).slice(-7)}`,
        guardianPhone: `0322${String(2000000 + roll).slice(-7)}`,
        gender: idx % 3 === 2 ? "female" : "male",
        dateOfBirth: new Date(2010, g % 12, 6 + g),
        address: "Lahore",
        admissionDate: new Date(),
        monthlyFee: 5500,
        rollNumber: String(roll),
        session: SESSION,
        academy: academy._id,
        class: klass._id,
        section: section._id,
        major: "science",
        group,
        gradeLevel: 10,
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
    gradeLevel: 10,
    students: students.map((s) => ({
      _id: s._id,
      group: s.group,
      major: s.major,
    })),
  });

  const rolls = students.map((s) => Number(s.rollNumber)).filter(Boolean);
  const lo = rolls.length ? Math.min(...rolls) : startRoll;
  const hi = rolls.length ? Math.max(...rolls) : startRoll;
  console.log(
    `  ${section.name}: students=${students.length} rolls ${lo}–${hi} (bio+comp)`
  );
  return { count: docs.length, nextRoll: roll };
}

async function seedAcademy(academy) {
  console.log(`\n${academy.name}`);
  const klass = await Class.findOne({
    academy: academy._id,
    $or: [{ gradeLevel: 10 }, { name: /class\s*10|10th|\b10\b/i }],
  }).lean();
  if (!klass) {
    console.log("  skip: no Class 10");
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

  for (const section of sections) {
    await clearSection(academy._id, section._id);
  }

  console.log(`  Class 10 · sections=${sections.length}`);
  let nameOffset = 0;
  let nextRoll = START_ROLL;
  for (const section of sections) {
    const result = await seedSection({
      academy,
      klass,
      section,
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
