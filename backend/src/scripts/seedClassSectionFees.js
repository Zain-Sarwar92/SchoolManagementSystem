/**
 * Seed students into 2 sections per class + admission/monthly/other fees for last 8 months.
 * Usage: node src/scripts/seedClassSectionFees.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import FeeCharge from "../models/FeeCharge.js";
import FeeHead from "../models/FeeHead.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
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
import {
  chargePeriodKey,
  ensureDefaultFeeHeads,
  feeHeadDueInPeriod,
  makeReceiptNumber,
  ONE_TIME_PERIOD_KEY,
} from "../utils/feeHelpers.js";

dotenv.config();

const SESSION = "2026-2027";
const PER_SECTION = 5;
const MONTHS_BACK = 8;
const PAID_MONTHS = 6; // first 6 of the 8 are paid; last 2 unpaid

const FIRST = [
  "Ahmed", "Ali", "Hassan", "Usman", "Hamza", "Omar", "Sara", "Noor", "Ayesha", "Maryam",
];
const LAST = [
  "Khan", "Malik", "Raza", "Qureshi", "Bhatti", "Shah", "Mirza", "Hashmi", "Nawaz", "Ahmed",
];
const FATHER = [
  "Muhammad", "Saeed", "Imran", "Faisal", "Adnan", "Khalid", "Waqar", "Rashid", "Jameel", "Tariq",
];

const pick = (arr, i) => arr[Math.abs(i) % arr.length];

const preferSectionNames = ["Red", "Blue", "Green", "Yellow", "A", "B"];

function pickTwoSections(sections) {
  const ranked = [...sections].sort((a, b) => {
    const ai = preferSectionNames.indexOf(a.name);
    const bi = preferSectionNames.indexOf(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return ranked.slice(0, 2);
}

function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return out;
}

function resolveAmount(head, student) {
  if (head.name === "Monthly Fee" || head.category === "tuition") {
    return Number(student.monthlyFee) || 0;
  }
  if (head.defaultAmount != null) return Number(head.defaultAmount) || 0;
  return 0;
}

async function fixAdmissionHeads(academyId) {
  await FeeHead.updateMany(
    {
      academy: academyId,
      $or: [{ name: "Admission Fee" }, { category: "admission" }],
    },
    { $set: { frequency: "one_time", isActive: true } }
  );
}

async function seedFeesForStudent({ academyId, student, heads, periods }) {
  let charges = 0;
  let payments = 0;

  const admission = heads.find(
    (h) => h.name === "Admission Fee" || h.category === "admission"
  );
  const monthlyHeads = heads.filter(
    (h) => h.frequency !== "one_time" && h.isActive !== false
  );

  if (admission) {
    const amount = resolveAmount(admission, student);
    if (amount > 0) {
      const charge = await FeeCharge.create({
        academy: academyId,
        student: student._id,
        feeHead: admission._id,
        session: SESSION,
        periodKey: ONE_TIME_PERIOD_KEY,
        description: admission.name,
        amount,
        status: "paid",
        dueDate: student.admissionDate || null,
      });
      charges += 1;
      const payment = await FeePayment.create({
        academy: academyId,
        student: student._id,
        amount,
        method: "cash",
        paidAt: student.admissionDate || new Date(),
        note: "Seed admission fee",
        receiptNumber: makeReceiptNumber(),
      });
      await FeePaymentAllocation.create({
        academy: academyId,
        payment: payment._id,
        charge: charge._id,
        amount,
      });
      payments += 1;
    }
  }

  for (let mi = 0; mi < periods.length; mi += 1) {
    const periodKey = periods[mi];
    const markPaid = mi < PAID_MONTHS;
    const items = [];

    for (const head of monthlyHeads) {
      if (!feeHeadDueInPeriod(head, periodKey)) continue;
      const amount = resolveAmount(head, student);
      if (!(amount > 0)) continue;
      const key = chargePeriodKey(head, periodKey);
      const charge = await FeeCharge.create({
        academy: academyId,
        student: student._id,
        feeHead: head._id,
        session: SESSION,
        periodKey: key,
        description: `${head.name} ${key}`,
        amount,
        status: markPaid ? "paid" : "unpaid",
        dueDate: new Date(`${key}-10T00:00:00.000Z`),
      });
      charges += 1;
      if (markPaid) items.push({ charge, amount });
    }

    if (items.length) {
      const total = items.reduce((sum, row) => sum + row.amount, 0);
      const payment = await FeePayment.create({
        academy: academyId,
        student: student._id,
        amount: total,
        method: "cash",
        paidAt: new Date(`${periodKey}-12T00:00:00.000Z`),
        note: `Seed fees ${periodKey}`,
        receiptNumber: makeReceiptNumber(),
      });
      for (const row of items) {
        await FeePaymentAllocation.create({
          academy: academyId,
          payment: payment._id,
          charge: row.charge._id,
          amount: row.amount,
        });
      }
      payments += 1;
    }
  }

  return { charges, payments };
}

async function seedAcademy(academy) {
  const classes = await Class.find({
    academy: academy._id,
    isActive: { $ne: false },
  })
    .sort({ gradeLevel: 1, name: 1 })
    .lean();

  if (!classes.length) {
    console.log(`${academy.name}: no classes, skip`);
    return { students: 0, charges: 0, payments: 0 };
  }

  await ensureDefaultFeeHeads(academy._id);
  await fixAdmissionHeads(academy._id);
  const heads = await FeeHead.find({ academy: academy._id, isActive: true }).lean();
  const periods = lastMonths(MONTHS_BACK);
  const usedNameKeys = new Set();

  let studentsTotal = 0;
  let chargesTotal = 0;
  let paymentsTotal = 0;

  for (const schoolClass of classes) {
    const grade = resolveClassGrade(schoolClass) || Number(schoolClass.gradeLevel) || 9;
    const groups = groupsForGrade(grade);
    if (!groups.length) {
      console.log(`  ${schoolClass.name}: no science groups, skip`);
      continue;
    }

    const allSections = await Section.find({
      academy: academy._id,
      class: schoolClass._id,
      isActive: { $ne: false },
    }).lean();

    if (allSections.length < 1) {
      console.log(`  ${schoolClass.name}: no sections, skip`);
      continue;
    }

    const sections = pickTwoSections(allSections);
    console.log(
      `  ${schoolClass.name}: sections ${sections.map((s) => s.name).join(" + ")}`
    );

    for (let si = 0; si < sections.length; si += 1) {
      const section = sections[si];
      const rollPrefix = buildRollPrefix(schoolClass.name, section.name);
      const docs = [];

      for (let index = 0; index < PER_SECTION; index += 1) {
        let name = "";
        let fatherName = "";
        const seedKey = grade * 1000 + si * 97 + index * 13 + schoolClass.name.length * 19;
        for (let attempt = 0; attempt < 200; attempt += 1) {
          const n = seedKey + attempt * 31;
          name = `${pick(FIRST, n)} ${pick(LAST, n * 5 + si + attempt)}`;
          fatherName = `${pick(FATHER, n * 7 + attempt)} ${pick(LAST, n * 11 + 2 + attempt)}`;
          const key = `${name}|${fatherName}`.toLowerCase();
          if (!usedNameKeys.has(key)) {
            usedNameKeys.add(key);
            break;
          }
          if (attempt === 199) {
            name = `${pick(FIRST, n)} ${section.name} ${index + 1}`;
            fatherName = `${pick(FATHER, n)} ${schoolClass.name}`;
            usedNameKeys.add(`${name}|${fatherName}`.toLowerCase());
          }
        }
        const gender = index % 2 === 0 ? "male" : "female";
        docs.push({
          name,
          fatherName,
          phone: `0312${String(1000000 + grade * 10000 + si * 100 + index + studentsTotal).slice(0, 7)}`,
          guardianPhone: "",
          email: "",
          gender,
          dateOfBirth: new Date(
            `${2026 - (grade + 5)}-05-${String((index % 27) + 1).padStart(2, "0")}T00:00:00.000Z`
          ),
          cnicOrBForm: "",
          address: `House ${10 + index}, Street ${si + 1}, Lahore`,
          admissionDate: new Date("2026-03-01T00:00:00.000Z"),
          monthlyFee: 4000 + (grade - 9) * 400 + si * 100,
          bloodGroup: pick(["A+", "B+", "O+", "AB+"], seedKey),
          rollNumber: formatSectionRoll(rollPrefix, index + 1),
          session: SESSION,
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
      studentsTotal += created.length;
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

      for (const student of created) {
        const fee = await seedFeesForStudent({
          academyId: academy._id,
          student,
          heads,
          periods,
        });
        chargesTotal += fee.charges;
        paymentsTotal += fee.payments;
      }

      console.log(
        `    ${section.name}: ${created.length} students + fees (${periods[0]} → ${periods[periods.length - 1]})`
      );
    }
  }

  return { students: studentsTotal, charges: chargesTotal, payments: paymentsTotal };
}

const run = async () => {
  try {
    await connectDB();

    // Clear previous students + fee ledger only (keep classes/sections/fee types)
    const [alloc, pays, charges, subjects, students] = await Promise.all([
      FeePaymentAllocation.deleteMany({}),
      FeePayment.deleteMany({}),
      FeeCharge.deleteMany({}),
      StudentSubject.deleteMany({}),
      Student.deleteMany({}),
    ]);
    console.log(
      `Cleared students=${students.deletedCount}, subjects=${subjects.deletedCount}, charges=${charges.deletedCount}, payments=${pays.deletedCount}, allocations=${alloc.deletedCount}`
    );

    const academies = await Academy.find({}).sort({ name: 1 });
    let totals = { students: 0, charges: 0, payments: 0 };

    for (const academy of academies) {
      console.log(`\n${academy.name}`);
      const result = await seedAcademy(academy);
      totals.students += result.students;
      totals.charges += result.charges;
      totals.payments += result.payments;
    }

    console.log("\nSeed complete:", totals);
    console.log(
      `Session ${SESSION} · ${MONTHS_BACK} months · first ${PAID_MONTHS} paid, rest unpaid`
    );
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
