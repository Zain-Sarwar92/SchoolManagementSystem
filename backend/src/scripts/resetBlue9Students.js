/**
 * Delete ALL students (+ related marks/fees/enrollments), then seed
 * Class 9 / Blue with roll numbers 1101, 1102, ...
 *
 * Usage: node src/scripts/resetBlue9Students.js
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
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import { groupsForGrade } from "../constants/scienceCurriculum.js";
import { syncManyStudentSubjects } from "../utils/studentEnrollment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const COUNT = 15;
const START_ROLL = 1101;
const SESSION = currentAcademicSession();

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
];

async function clearAllStudents() {
  const [alloc, pays, charges, marks, subjects, students] = await Promise.all([
    FeePaymentAllocation.deleteMany({}),
    FeePayment.deleteMany({}),
    FeeCharge.deleteMany({}),
    StudentMark.deleteMany({}),
    StudentSubject.deleteMany({}),
    Student.deleteMany({}),
  ]);
  console.log(
    `Cleared: students=${students.deletedCount}, subjects=${subjects.deletedCount}, marks=${marks.deletedCount}, charges=${charges.deletedCount}, payments=${pays.deletedCount}, allocations=${alloc.deletedCount}`
  );
}

async function findNinthBlue(academyId) {
  const classes = await Class.find({ academy: academyId }).lean();
  const ninth = classes.find((c) => {
    const grade = Number(c.gradeLevel);
    if (grade === 9) return true;
    return /\b9\b|9th|class\s*9/i.test(String(c.name || ""));
  });
  if (!ninth) {
    throw new Error(
      `No Class 9 found. Classes: ${classes.map((c) => c.name).join(", ") || "(none)"}`
    );
  }

  const sections = await Section.find({
    academy: academyId,
    class: ninth._id,
  }).lean();
  const blue = sections.find((s) => /^blue$/i.test(String(s.name || "").trim()));
  if (!blue) {
    throw new Error(
      `No Blue section under ${ninth.name}. Sections: ${
        sections.map((s) => s.name).join(", ") || "(none)"
      }`
    );
  }

  return { schoolClass: ninth, section: blue };
}

async function seedBlueStudents(academy) {
  const { schoolClass, section } = await findNinthBlue(academy._id);
  const gradeLevel = Number(schoolClass.gradeLevel) || 9;
  const groups = groupsForGrade(gradeLevel) || ["bio"];
  const group = groups[0];

  console.log(
    `Seeding ${COUNT} students → ${schoolClass.name} / ${section.name} (rolls ${START_ROLL}–${START_ROLL + COUNT - 1}), session ${SESSION}, group ${group}`
  );

  const docs = [];
  for (let i = 0; i < COUNT; i += 1) {
    const rollNumber = String(START_ROLL + i);
    const gender = i % 3 === 2 ? "female" : "male";
    docs.push({
      name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      fatherName: `${FATHER[i % FATHER.length]} ${LAST[(i + 3) % LAST.length]}`,
      phone: `0300${String(1000000 + i).slice(-7)}`,
      guardianPhone: `0321${String(2000000 + i).slice(-7)}`,
      email: "",
      gender,
      dateOfBirth: new Date(2010, i % 12, 5 + (i % 20)),
      address: "Lahore",
      admissionDate: new Date(),
      monthlyFee: 5000,
      rollNumber,
      session: SESSION,
      academy: academy._id,
      class: schoolClass._id,
      section: section._id,
      major: "science",
      group,
      gradeLevel,
      isActive: true,
    });
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

  for (const s of created) {
    console.log(`  ${s.rollNumber}  ${s.name}`);
  }

  return created.length;
}

const run = async () => {
  try {
    await connectDB();
    await clearAllStudents();

    const academies = await Academy.find({}).sort({ name: 1 });
    if (!academies.length) {
      throw new Error("No academy found. Create an academy first.");
    }

    let total = 0;
    for (const academy of academies) {
      console.log(`\nAcademy: ${academy.name}`);
      try {
        total += await seedBlueStudents(academy);
      } catch (err) {
        console.log(`  skip: ${err.message}`);
      }
    }

    if (!total) {
      throw new Error("No Class 9 / Blue section found in any academy.");
    }

    console.log(`\nDone. Added ${total} student(s) to 9th Blue.`);
  } catch (error) {
    console.error("Failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
