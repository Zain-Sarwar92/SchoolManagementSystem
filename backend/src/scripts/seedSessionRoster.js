/**
 * Fill every class and section for sessions 2020-2021 through 2026-2027.
 * Each session is independent — no cross-year promotion linking.
 * Usage: node src/scripts/seedSessionRoster.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import { resolveClassGrade } from "../constants/majors.js";
import { groupsForGrade } from "../constants/scienceCurriculum.js";
import {
  buildRollPrefix,
  formatSectionRoll,
  syncManyStudentSubjects,
} from "../utils/studentEnrollment.js";

dotenv.config();

const SESSIONS = [
  "2020-2021",
  "2021-2022",
  "2022-2023",
  "2023-2024",
  "2024-2025",
  "2025-2026",
  "2026-2027",
];
const PER_SECTION = 30;

const FIRST = [
  "Ahmed", "Ali", "Hassan", "Bilal", "Usman", "Hamza", "Zain", "Omar",
  "Yousuf", "Ibrahim", "Sami", "Taha", "Rehan", "Danish", "Ayesha", "Fatima",
  "Sara", "Maryam", "Hira", "Noor", "Iqra", "Laiba", "Maham", "Zara",
  "Amna", "Sana", "Khadija", "Eman", "Areeba", "Farhan", "Imran", "Saad",
];
const LAST = [
  "Khan", "Ali", "Ahmed", "Hussain", "Raza", "Malik", "Butt", "Sheikh",
  "Qureshi", "Chaudhry", "Dar", "Mirza", "Abbas", "Iqbal", "Nawaz", "Akhtar",
  "Siddiqui", "Bhatti", "Javed", "Farooq", "Hashmi", "Kazmi", "Lone", "Shah",
];
const FATHER = [
  "Muhammad", "Abdul", "Ghulam", "Saeed", "Imran", "Nadeem", "Tariq", "Shahid",
  "Asif", "Kashif", "Jameel", "Rashid", "Waqar", "Faisal", "Adnan", "Khalid",
];
const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Multan", "Rawalpindi"];
const BLOODS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const pick = (arr, i) => arr[Math.abs(i) % arr.length];

const dropLegacyIndexes = async () => {
  const indexes = await Student.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  for (const name of [
    "academy_1_session_1_nameKey_1",
    "academy_1_session_1_admissionNo_1",
    "academy_1_session_1_phone_1",
    "academy_1_admissionNo_1",
    "academy_1_rollNumber_1",
    "academy_1_name_1_fatherName_1",
  ]) {
    if (!names.has(name)) continue;
    await Student.collection.dropIndex(name);
    console.log(`Dropped index ${name}`);
  }
  await Student.syncIndexes();
};

const seedAcademy = async (academy) => {
  const classes = await Class.find({ academy: academy._id, isActive: { $ne: false } })
    .sort({ name: 1 })
    .lean();
  if (!classes.length) {
    console.log(`${academy.name}: no classes, skipped`);
    return;
  }

  let total = 0;
  const usedNames = new Map();

  for (const schoolClass of classes) {
    const grade = resolveClassGrade(schoolClass);
    if (!grade) continue;
    const groups = groupsForGrade(grade);
    if (!groups.length) continue;

    const sections = await Section.find({
      academy: academy._id,
      class: schoolClass._id,
      isActive: { $ne: false },
    })
      .sort({ name: 1 })
      .lean();

    for (let si = 0; si < sections.length; si += 1) {
      const section = sections[si];
      const rollPrefix = buildRollPrefix(schoolClass.name, section.name);

      for (const session of SESSIONS) {
        const startYear = Number(session.slice(0, 4));
        const nameSetKey = `${academy._id}|${session}`;
        if (!usedNames.has(nameSetKey)) usedNames.set(nameSetKey, new Set());
        const usedNameKeys = usedNames.get(nameSetKey);
        const seedKey = startYear * 1000 + si * 37 + schoolClass.name.length + grade * 11;

        const docs = [];
        for (let index = 0; index < PER_SECTION; index += 1) {
          let name = "";
          let fatherName = "";
          for (let attempt = 0; attempt < 5000; attempt += 1) {
            const n = seedKey * 97 + index * 131 + attempt * 17;
            const f = seedKey * 41 + index * 211 + attempt * 19;
            name = `${pick(FIRST, n)} ${pick(LAST, n * 3 + 5)}`;
            fatherName = `${pick(FATHER, f)} ${pick(LAST, f * 7 + 11)}`;
            const key = `${name}|${fatherName}`.toLowerCase();
            if (!usedNameKeys.has(key)) {
              usedNameKeys.add(key);
              break;
            }
            if (attempt === 4999) {
              name = `${pick(FIRST, n)} ${pick(LAST, n)} ${session} ${index + 1}`;
              fatherName = `${pick(FATHER, f)} ${pick(LAST, f)} ${seedKey}`;
              usedNameKeys.add(`${name}|${fatherName}`.toLowerCase());
            }
          }

          const gender = index % 3 === 0 ? "female" : "male";
          const birthYear = startYear - (grade + 5);
          docs.push({
            name,
            fatherName,
            phone: `03${String(100000000 + ((seedKey * 13 + index * 7) % 900000000)).padStart(9, "0").slice(0, 9)}`,
            guardianPhone: `03${String(200000000 + ((seedKey * 19 + index * 3) % 800000000)).padStart(9, "0").slice(0, 9)}`,
            email: "",
            gender,
            dateOfBirth: new Date(
              `${birthYear}-06-${String((index % 27) + 1).padStart(2, "0")}T00:00:00.000Z`
            ),
            cnicOrBForm: "",
            address: `House ${(index % 80) + 10}, Street ${(index % 18) + 1}, ${pick(CITIES, seedKey + index)}`,
            admissionDate: new Date(`${startYear}-04-15T00:00:00.000Z`),
            monthlyFee: 3800 + (grade - 9) * 300 + (startYear - 2020) * 150,
            bloodGroup: pick(BLOODS, seedKey + index),
            rollNumber: formatSectionRoll(rollPrefix, index + 1),
            session,
            academy: academy._id,
            class: schoolClass._id,
            section: section._id,
            major: "science",
            group: groups[index % groups.length],
            gradeLevel: grade,
            isActive: true,
          });
        }

        const created = await Student.insertMany(docs, { ordered: true });
        total += created.length;
        await syncManyStudentSubjects({
          academyId: academy._id,
          classId: schoolClass._id,
          gradeLevel: grade,
          students: created.map((student) => ({
            _id: student._id,
            group: student.group,
            major: student.major,
          })),
        });
      }

      console.log(
        `  ${schoolClass.name} / ${section.name}: ${SESSIONS.length} sessions × ${PER_SECTION} students`
      );
    }
  }

  console.log(`${academy.name}: ${total} records`);
};

const run = async () => {
  try {
    await connectDB();
    const subjects = await StudentSubject.deleteMany({});
    const students = await Student.deleteMany({});
    console.log(
      `Cleared ${students.deletedCount} students and ${subjects.deletedCount} subject rows`
    );
    await dropLegacyIndexes();

    const academies = await Academy.find({}).sort({ name: 1 });
    for (const academy of academies) {
      await seedAcademy(academy);
    }
    console.log("Roster seed complete.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
