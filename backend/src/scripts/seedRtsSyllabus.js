/**
 * Fill syllabusText on all assignments of the RTS schedule.
 */
import "dotenv/config";
import mongoose from "mongoose";
import TestSchedule from "../models/TestSchedule.js";
import TestScheduleRound from "../models/TestScheduleRound.js";
import TestScheduleSubject from "../models/TestScheduleSubject.js";
import TestScheduleSubjectClass from "../models/TestScheduleSubjectClass.js";
import TestScheduleAssignment from "../models/TestScheduleAssignment.js";

const SYLLABUS = {
  Biology: "Ch 1–3 · Cell biology, tissues, enzymes",
  Chemistry: "Ch 1–3 · Fundamentals, structure, stoichiometry",
  "Computer Science": "Ch 1–3 · Intro, hardware, software basics",
  English: "Unit 1–3 · Prose, grammar, comprehension",
  Islamiyat: "Unit 1–2 · Beliefs & selected Ahadith",
  Mathematics: "Ch 1–4 · Algebra, matrices, quadratic eq.",
  "Pakistan Studies": "Ch 1–2 · Ideology & historical background",
  Physics: "Ch 1–3 · Physical quantities, kinematics, dynamics",
  "Tarjuma-tul-Quran-ul-Majeed": "Selected Surahs · translation & vocabulary",
  Urdu: "Unit 1–3 · Nazm, nasr, grammar",
};

await mongoose.connect(process.env.MONGO_URI);

const schedule = await TestSchedule.findOne({ name: /^RTS$/i });
if (!schedule) {
  console.error("RTS schedule not found");
  process.exit(1);
}

const rounds = await TestScheduleRound.find({ schedule: schedule._id }).lean();
let updated = 0;

for (const round of rounds) {
  const subjects = await TestScheduleSubject.find({ round: round._id }).lean();
  for (const subject of subjects) {
    const text =
      SYLLABUS[subject.subjectName] ||
      `${subject.subjectName} · syllabus as per scheme`;
    const scs = await TestScheduleSubjectClass.find({
      scheduleSubject: subject._id,
    }).lean();
    for (const sc of scs) {
      const res = await TestScheduleAssignment.updateMany(
        { scheduleSubjectClass: sc._id },
        { $set: { syllabusText: text } }
      );
      updated += res.modifiedCount;
    }
  }
}

console.log(`RTS syllabus filled on ${updated} assignment(s).`);
await mongoose.disconnect();
