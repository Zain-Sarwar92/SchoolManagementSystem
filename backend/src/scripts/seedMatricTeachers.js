/**
 * Seed Matric (Class 9–10) teachers:
 * - Every subject gets min 2 / max 4 teachers (team for that subject)
 * - Class 9–10 section slots are divided round-robin among that subject’s teachers
 *   so the team covers every section (e.g. Bio: Sir Ali + Sir Usman split all 9–10 sections)
 *
 * Usage: node src/scripts/seedMatricTeachers.js
 * Optional: ACADEMY_SLUG=bright-future-academy node src/scripts/seedMatricTeachers.js
 * Optional: TEACHERS_PER_SUBJECT=2 (default auto 2–4)
 */
import "dotenv/config";
import mongoose from "mongoose";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { SCIENCE_CURRICULUM_PACKAGES } from "../constants/scienceCurriculum.js";

const DEFAULT_PASSWORD = "Teacher@12345";

/** Friendly first names paired per subject (Sir X). */
const SUBJECT_TEACHER_NAMES = {
  English: ["Sir Hassan", "Sir Omar", "Sir Farhan", "Sir Imran"],
  Urdu: ["Sir Javed", "Sir Tariq", "Sir Nadeem", "Sir Asif"],
  Mathematics: ["Sir Kamran", "Sir Faisal", "Sir Saad", "Sir Haroon"],
  Physics: ["Sir Ahmed", "Sir Bilal", "Sir Danish", "Sir Hamza"],
  Chemistry: ["Sir Rizwan", "Sir Waqas", "Sir Adnan", "Sir Shahid"],
  Biology: ["Sir Ali", "Sir Usman", "Sir Zohaib", "Sir Arslan"],
  "Computer Science": ["Sir Noman", "Sir Salman", "Sir Kashif", "Sir Rehan"],
  Islamiyat: ["Sir Ibrahim", "Sir Yusuf", "Sir Suleman", "Sir Ismail"],
  "Pakistan Studies": ["Sir Ahsan", "Sir Basit", "Sir Qasim", "Sir Rafay"],
  "Tarjuma-tul-Quran-ul-Majeed": [
    "Sir Abdullah",
    "Sir Rahman",
    "Sir Mustafa",
    "Sir Haseeb",
  ],
};

function matricSubjectNames() {
  const names = new Set();
  for (const pkg of SCIENCE_CURRICULUM_PACKAGES) {
    if (pkg.gradeLevel === 9 || pkg.gradeLevel === 10) {
      for (const name of pkg.subjects) names.add(name);
    }
  }
  return [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

async function ensureSubjects(names) {
  const map = new Map();
  for (const name of names) {
    let doc = await Subject.findOne({ name }).sort({ _id: 1 });
    if (!doc) {
      try {
        doc = await Subject.create({ name, stream: "science", isActive: true });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        doc = await Subject.findOne({ name }).sort({ _id: 1 });
      }
    }
    map.set(name, doc);
  }
  return map;
}

function teacherCountForSections(sectionSlotCount) {
  const forced = Number(process.env.TEACHERS_PER_SUBJECT);
  if (forced >= 2 && forced <= 4) return forced;
  // min 2, max 4 — more teachers when many sections
  if (sectionSlotCount <= 6) return 2;
  if (sectionSlotCount <= 10) return 3;
  return 4;
}

function slugifyPart(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function upsertTeacher({
  academy,
  name,
  email,
  password = DEFAULT_PASSWORD,
}) {
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    user.role = "teacher";
    user.teacherLevel = "MATRIC";
    user.academy = academy._id;
    user.isActive = true;
    if (password) user.password = password;
    await user.save();
    return user;
  }
  user = await User.create({
    name,
    email,
    password,
    role: "teacher",
    teacherLevel: "MATRIC",
    academy: academy._id,
    isActive: true,
  });
  return user;
}

async function seedAcademy(academy) {
  const classes = await Class.find({
    academy: academy._id,
    isActive: true,
    gradeLevel: { $in: [9, 10] },
  })
    .sort({ gradeLevel: 1, name: 1 })
    .lean();

  if (!classes.length) {
    console.log(`  skip ${academy.name}: no Class 9/10`);
    return { teachers: 0, assignments: 0 };
  }

  const classIds = classes.map((c) => c._id);
  const sections = await Section.find({
    academy: academy._id,
    class: { $in: classIds },
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  if (!sections.length) {
    console.log(`  skip ${academy.name}: no sections on Class 9/10`);
    return { teachers: 0, assignments: 0 };
  }

  // Stable class×section slots
  const slots = [];
  for (const klass of classes) {
    const classSections = sections
      .filter((s) => String(s.class) === String(klass._id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
    for (const section of classSections) {
      slots.push({ class: klass, section });
    }
  }

  const subjectNames = matricSubjectNames();
  const subjectByName = await ensureSubjects(subjectNames);
  const count = teacherCountForSections(slots.length);

  console.log(
    `  ${academy.name}: ${classes.length} classes, ${slots.length} section slots, ${subjectNames.length} subjects, ${count} teachers/subject`
  );

  let teacherTotal = 0;
  let assignmentTotal = 0;

  for (const subjectName of subjectNames) {
    const subject = subjectByName.get(subjectName);
    const namePool =
      SUBJECT_TEACHER_NAMES[subjectName] ||
      Array.from({ length: 4 }, (_, i) => `Sir ${subjectName} ${i + 1}`);

    const teachers = [];
    for (let i = 0; i < count; i++) {
      const displayName = namePool[i] || `Sir ${subjectName} ${i + 1}`;
      const email = `${slugifyPart(subjectName)}.t${i + 1}.${academy.slug}@teachers.local`;
      const teacher = await upsertTeacher({
        academy,
        name: displayName,
        email,
      });
      teachers.push(teacher);
      teacherTotal += 1;

      // Clear prior assignments for this teacher (re-seed clean)
      await TeacherAssignment.deleteMany({
        academy: academy._id,
        teacher: teacher._id,
      });
    }

    // Also clear any leftover assignments for this subject on matric classes
    // from other teachers of previous runs with different emails — optional narrow clear:
    await TeacherAssignment.deleteMany({
      academy: academy._id,
      subject: subject._id,
      class: { $in: classIds },
      teacher: { $nin: teachers.map((t) => t._id) },
    });

    // Divide Class 9–10 section slots round-robin across this subject’s teachers
    const docs = [];
    const perTeacher = teachers.map(() => 0);
    for (let idx = 0; idx < slots.length; idx++) {
      const teacherIndex = idx % teachers.length;
      const teacher = teachers[teacherIndex];
      const { class: klass, section } = slots[idx];
      docs.push({
        academy: academy._id,
        teacher: teacher._id,
        class: klass._id,
        section: section._id,
        subject: subject._id,
      });
      perTeacher[teacherIndex] += 1;
    }

    if (docs.length) {
      await TeacherAssignment.insertMany(docs, { ordered: false }).catch(
        async (err) => {
          if (err?.code !== 11000) throw err;
          for (const doc of docs) {
            await TeacherAssignment.updateOne(
              {
                teacher: doc.teacher,
                class: doc.class,
                section: doc.section,
                subject: doc.subject,
              },
              { $set: doc },
              { upsert: true }
            );
          }
        }
      );
      assignmentTotal += docs.length;
    }

    const split = teachers
      .map((t, i) => `${t.name} (${perTeacher[i]} secs)`)
      .join(" · ");
    console.log(`    ${subjectName}: ${split}`);
  }

  return { teachers: teacherTotal, assignments: assignmentTotal };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");
  await mongoose.connect(uri);

  const slugFilter = process.env.ACADEMY_SLUG?.trim();
  const academies = slugFilter
    ? await Academy.find({ slug: slugFilter })
    : await Academy.find({ status: { $ne: "suspended" } }).sort({ name: 1 });

  console.log(
    `Seeding Matric teachers (password: ${DEFAULT_PASSWORD})${
      slugFilter ? ` for ${slugFilter}` : " for all academies"
    }\n`
  );

  let teachers = 0;
  let assignments = 0;
  for (const academy of academies) {
    const result = await seedAcademy(academy);
    teachers += result.teachers;
    assignments += result.assignments;
  }

  console.log(`\nDone. Teachers upserted: ${teachers}, assignments: ${assignments}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
