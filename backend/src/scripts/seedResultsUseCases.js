/**
 * Seed result use-cases for QA:
 * - Round 1 / 2 / 3 (dated) on Class 9 Blue (+ Green for multi-section Generate)
 * - Normal marks, full-absent students, subject-absent, incomplete marks
 * - Manual (off-roster) students, clear pass / fail cases
 *
 * Usage: node src/scripts/seedResultsUseCases.js
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
import AssessmentManualMark from "../models/AssessmentManualMark.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import { currentAcademicSession } from "../utils/academicSession.js";

dotenv.config();

const SESSION = currentAcademicSession();
const TOTAL = 100;
const PASS_PERCENT = 33;

/** Chronological dates so R1 → R2 → R3 sort correctly */
const ROUNDS = [
  { name: "Round 1", examDate: new Date("2026-01-15T00:00:00") },
  { name: "Round 2", examDate: new Date("2026-02-20T00:00:00") },
  { name: "Round 3", examDate: new Date("2026-03-25T00:00:00") },
];

async function findClassSection(academyId, gradeLevel, sectionName) {
  const klass = await Class.findOne({
    academy: academyId,
    $or: [
      { gradeLevel },
      { name: new RegExp(`class\\s*${gradeLevel}|${gradeLevel}th|\\b${gradeLevel}\\b`, "i") },
    ],
  }).lean();
  if (!klass) return null;
  const section = await Section.findOne({
    academy: academyId,
    class: klass._id,
    name: new RegExp(`^${sectionName}$`, "i"),
  }).lean();
  if (!section) return null;
  return { klass, section };
}

async function ensureExam(academyId, { name, examDate }) {
  let exam = await ExamTerm.findOne({ academy: academyId, name, session: SESSION });
  if (!exam) {
    exam = await ExamTerm.create({
      academy: academyId,
      name,
      session: SESSION,
      passPercent: PASS_PERCENT,
      examDate,
    });
  } else {
    exam.passPercent = PASS_PERCENT;
    exam.examDate = examDate;
    await exam.save();
  }
  return exam;
}

function scoreFor({ rollNum, subjectIndex, roundIndex, mode }) {
  if (mode === "fail") {
    return Math.min(32, 10 + ((rollNum + subjectIndex + roundIndex) % 20));
  }
  if (mode === "high") {
    return Math.min(TOTAL, 85 + ((rollNum + subjectIndex) % 15));
  }
  return Math.min(
    TOTAL,
    Math.max(
      40,
      ((rollNum * 7 + subjectIndex * 3 + (roundIndex + 1) * 13) % 55) + 40
    )
  );
}

async function clearSectionExam(academyId, sectionId, examId) {
  const old = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .select("_id")
    .lean();
  const ids = old.map((a) => a._id);
  if (!ids.length) return;
  await Promise.all([
    StudentMark.deleteMany({ assessment: { $in: ids } }),
    AssessmentManualMark.deleteMany({ assessment: { $in: ids } }),
    SubjectAssessment.deleteMany({ _id: { $in: ids } }),
  ]);
}

/**
 * Per-student scenario by roll index within section:
 *  0 → full absent in Round 3 (all subjects)
 *  1 → subject-absent (first enrolled subject only) every round
 *  2 → incomplete Round 3 (skip last subject)
 *  3 → fail-band marks (likely FAIL)
 *  4 → high marks (clear PASS)
 *  rest → normal
 */
function scenarioForIndex(i) {
  if (i === 0) return "full_absent_r3";
  if (i === 1) return "subject_absent";
  if (i === 2) return "incomplete_r3";
  if (i === 3) return "fail";
  if (i === 4) return "high";
  return "normal";
}

async function seedSectionRounds(academy, klass, section, opts = {}) {
  const { withManual = true, label = "" } = opts;
  const tag = label || `${klass.name}/${section.name}`;

  const students = await Student.find({
    academy: academy._id,
    section: section._id,
    isActive: true,
    session: SESSION,
  })
    .sort({ rollNumber: 1 })
    .lean();

  if (!students.length) {
    console.log(`  ${tag}: no students — skip`);
    return null;
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
    .sort({ name: 1 })
    .lean();

  const enrolled = new Map();
  for (const row of enrollRows) {
    const key = String(row.student);
    if (!enrolled.has(key)) enrolled.set(key, new Set());
    enrolled.get(key).add(String(row.subject));
  }

  const exams = [];
  for (const round of ROUNDS) {
    exams.push(await ensureExam(academy._id, round));
  }

  const report = {
    section: tag,
    sectionId: String(section._id),
    students: students.length,
    scenarios: {},
    rounds: [],
  };

  for (let r = 0; r < exams.length; r += 1) {
    const exam = exams[r];
    await clearSectionExam(academy._id, section._id, exam._id);

    let marksWritten = 0;
    let absents = 0;
    let skipped = 0;
    const assessmentsBySubject = new Map();

    for (let si = 0; si < subjects.length; si += 1) {
      const subject = subjects[si];
      const assessment = await SubjectAssessment.create({
        academy: academy._id,
        examTerm: exam._id,
        section: section._id,
        subject: subject._id,
        subjectName: subject.name,
        totalMarks: TOTAL,
      });
      assessmentsBySubject.set(String(subject._id), assessment);

      for (let i = 0; i < students.length; i += 1) {
        const student = students[i];
        const list = enrolled.get(String(student._id));
        if (list && list.size > 0 && !list.has(String(subject._id))) continue;

        const scenario = scenarioForIndex(i);
        report.scenarios[student.rollNumber] = scenario;

        const enrolledSubjects = subjects.filter((sub) => {
          const set = enrolled.get(String(student._id));
          return !set || set.size === 0 || set.has(String(sub._id));
        });
        const firstSubjectId = String(enrolledSubjects[0]?._id || "");
        const lastSubjectId = String(
          enrolledSubjects[enrolledSubjects.length - 1]?._id || ""
        );
        const subjectId = String(subject._id);

        // Full absent in Round 3 only
        if (scenario === "full_absent_r3" && r === 2) {
          await StudentMark.create({
            academy: academy._id,
            assessment: assessment._id,
            student: student._id,
            obtainedMarks: null,
            isAbsent: true,
          });
          marksWritten += 1;
          absents += 1;
          continue;
        }

        // One subject absent every round
        if (scenario === "subject_absent" && subjectId === firstSubjectId) {
          await StudentMark.create({
            academy: academy._id,
            assessment: assessment._id,
            student: student._id,
            obtainedMarks: null,
            isAbsent: true,
          });
          marksWritten += 1;
          absents += 1;
          continue;
        }

        // Incomplete Round 3 — leave last subject unentered
        if (
          scenario === "incomplete_r3" &&
          r === 2 &&
          subjectId === lastSubjectId
        ) {
          skipped += 1;
          continue;
        }

        const rollNum =
          Number(String(student.rollNumber).replace(/\D/g, "")) || i + 1;
        const mode =
          scenario === "fail" ? "fail" : scenario === "high" ? "high" : "normal";
        const obtained = scoreFor({
          rollNum,
          subjectIndex: si,
          roundIndex: r,
          mode,
        });

        await StudentMark.create({
          academy: academy._id,
          assessment: assessment._id,
          student: student._id,
          obtainedMarks: obtained,
          isAbsent: false,
        });
        marksWritten += 1;
      }
    }

    // Manual / transfer student on Round 3 (Blue only)
    let manuals = 0;
    if (withManual && r === 2 && assessmentsBySubject.size) {
      const firstAssessment = [...assessmentsBySubject.values()][0];
      const midAssessment = [...assessmentsBySubject.values()][
        Math.floor(assessmentsBySubject.size / 2)
      ];
      await AssessmentManualMark.create({
        academy: academy._id,
        assessment: firstAssessment._id,
        rollNumber: "T-901",
        name: "Transfer Ali",
        fatherName: "Imran Khan",
        obtainedMarks: 72,
        isAbsent: false,
      });
      await AssessmentManualMark.create({
        academy: academy._id,
        assessment: midAssessment._id,
        rollNumber: "T-902",
        name: "Late Join Sara",
        fatherName: "Nadeem Malik",
        obtainedMarks: null,
        isAbsent: true,
      });
      manuals = 2;
    }

    report.rounds.push({
      name: exam.name,
      examId: String(exam._id),
      subjects: subjects.length,
      marks: marksWritten,
      absents,
      incompleteSkips: skipped,
      manuals,
    });

    console.log(
      `  ${tag} · ${exam.name}: marks=${marksWritten} absents=${absents} incompleteSkip=${skipped} manuals=${manuals}`
    );
  }

  // Print scenario key for first few students
  console.log(`  ${tag} scenarios (roll → case):`);
  for (const student of students.slice(0, 6)) {
    console.log(
      `    ${student.rollNumber} ${student.name} → ${report.scenarios[student.rollNumber]}`
    );
  }

  return report;
}

const run = async () => {
  try {
    await connectDB();
    const academies = await Academy.find({}).sort({ name: 1 });
    if (!academies.length) {
      console.error("No academy found.");
      process.exitCode = 1;
      return;
    }

    let seeded = 0;
    for (const academy of academies) {
      const blue = await findClassSection(academy._id, 9, "Blue");
      if (!blue) {
        console.log(`\n${academy.name}: skip (no Class 9 / Blue)`);
        continue;
      }

      console.log(`\n${academy.name} · session ${SESSION}`);
      console.log("Seeding result use-cases (Round 1–3)…\n");

      await seedSectionRounds(academy, blue.klass, blue.section, {
        withManual: true,
        label: "Class 9 / Blue",
      });

      const green = await findClassSection(academy._id, 9, "Green");
      if (green) {
        await seedSectionRounds(academy, green.klass, green.section, {
          withManual: false,
          label: "Class 9 / Green",
        });
      } else {
        console.log(
          "  Class 9 / Green not found — multi-section Generate limited to Blue"
        );
      }
      seeded += 1;
    }

    if (!seeded) {
      console.error("\nNo academy had Class 9 / Blue.");
      process.exitCode = 1;
      return;
    }

    console.log(`
Done. How to test in UI:

1) Results → Generate on "Round 3"
   - Blue + Green sheets (empty others skipped if linked)
2) Open Class 9 Blue → Round 3 marks / gazette
   - Full-absent student (first roll) → Abs / FAIL
   - Subject-absent student (2nd roll) → one Abs column
   - Incomplete student (3rd) → incomplete / no pass
   - Fail-band (4th) → low % FAIL
   - High (5th) → PASS
   - Manual rows: Transfer Ali + Late Join Sara (absent)
3) Student report → pick a student → select Round 3 (detail)
   - Accumulative shows Round 1 + 2 + 3
4) Compile → select Blue + Green + Round 1/2/3
   - Multi-round R1 R2 R3 columns, manuals on multi-round
`);
  } catch (error) {
    console.error("Failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
