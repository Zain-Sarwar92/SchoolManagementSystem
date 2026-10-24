/**
 * Wipe fee ledger and re-seed random paid/unpaid/skipped fees for existing students.
 * Usage: node src/scripts/seedRandomFees.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import FeeCharge from "../models/FeeCharge.js";
import FeeHead from "../models/FeeHead.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import Student from "../models/Student.js";
import {
  chargePeriodKey,
  ensureDefaultFeeHeads,
  feeHeadDueInPeriod,
  makeReceiptNumber,
  ONE_TIME_PERIOD_KEY,
} from "../utils/feeHelpers.js";

dotenv.config();

const MONTHS_BACK = 8;

const rand = () => Math.random();
const chance = (p) => rand() < p;

function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
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

async function seedStudentFees({ student, heads, periods, stats }) {
  const academyId = student.academy;
  const admission = heads.find(
    (h) => h.name === "Admission Fee" || h.category === "admission"
  );
  const monthlyHeads = heads.filter(
    (h) => h.frequency !== "one_time" && h.isActive !== false
  );

  // ~30% students: skip admission entirely
  // ~25%: admission exists but unpaid
  // rest: admission paid
  if (admission) {
    const amount = resolveAmount(admission, student);
    if (amount > 0) {
      const roll = rand();
      if (roll < 0.3) {
        stats.admissionSkipped += 1;
      } else {
        const paid = roll >= 0.55;
        const charge = await FeeCharge.create({
          academy: academyId,
          student: student._id,
          feeHead: admission._id,
          session: student.session,
          periodKey: ONE_TIME_PERIOD_KEY,
          description: admission.name,
          amount,
          status: paid ? "paid" : "unpaid",
          dueDate: student.admissionDate || null,
        });
        stats.charges += 1;
        if (paid) {
          const payment = await FeePayment.create({
            academy: academyId,
            student: student._id,
            amount,
            method: pickMethod(),
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
          stats.payments += 1;
          stats.admissionPaid += 1;
        } else {
          stats.admissionUnpaid += 1;
        }
      }
    }
  }

  for (const periodKey of periods) {
    const paidItems = [];

    for (const head of monthlyHeads) {
      if (!feeHeadDueInPeriod(head, periodKey)) continue;
      const amount = resolveAmount(head, student);
      if (!(amount > 0)) continue;

      // Random skip: ~12% charges never created (that fee skipped for month)
      // Monthly Fee skip rarer (~8%); other fees slightly higher (~15%)
      const isTuition = head.name === "Monthly Fee" || head.category === "tuition";
      if (chance(isTuition ? 0.08 : 0.15)) {
        stats.monthSkipped += 1;
        continue;
      }

      // Paid probability: older months more likely paid
      const age = periods.indexOf(periodKey); // 0 = oldest
      const paidChance = 0.35 + (age / Math.max(periods.length - 1, 1)) * -0.05 + (1 - age / periods.length) * 0.45;
      // roughly: oldest ~80% paid, newest ~35% paid
      const paid = chance(Math.min(0.88, Math.max(0.28, paidChance)));

      // Extra unpaid bias for random heads
      const forceUnpaid = chance(0.18);

      const key = chargePeriodKey(head, periodKey);
      const status = paid && !forceUnpaid ? "paid" : "unpaid";
      const charge = await FeeCharge.create({
        academy: academyId,
        student: student._id,
        feeHead: head._id,
        session: student.session,
        periodKey: key,
        description: `${head.name} ${key}`,
        amount,
        status,
        dueDate: new Date(`${key}-10T00:00:00.000Z`),
      });
      stats.charges += 1;
      if (status === "paid") {
        paidItems.push({ charge, amount });
        stats.monthPaid += 1;
      } else {
        stats.monthUnpaid += 1;
      }
    }

    if (paidItems.length) {
      const total = paidItems.reduce((sum, row) => sum + row.amount, 0);
      const payment = await FeePayment.create({
        academy: academyId,
        student: student._id,
        amount: total,
        method: pickMethod(),
        paidAt: new Date(`${periodKey}-${String(10 + Math.floor(rand() * 15)).padStart(2, "0")}T00:00:00.000Z`),
        note: `Seed fees ${periodKey}`,
        receiptNumber: makeReceiptNumber(),
      });
      for (const row of paidItems) {
        await FeePaymentAllocation.create({
          academy: academyId,
          payment: payment._id,
          charge: row.charge._id,
          amount: row.amount,
        });
      }
      stats.payments += 1;
    }
  }
}

function pickMethod() {
  const methods = ["cash", "cash", "cash", "bank_transfer", "card"];
  return methods[Math.floor(rand() * methods.length)];
}

const run = async () => {
  try {
    await connectDB();

    const [alloc, pays, charges] = await Promise.all([
      FeePaymentAllocation.deleteMany({}),
      FeePayment.deleteMany({}),
      FeeCharge.deleteMany({}),
    ]);
    console.log(
      `Cleared fee data: charges=${charges.deletedCount}, payments=${pays.deletedCount}, allocations=${alloc.deletedCount}`
    );

    const students = await Student.find({ isActive: { $ne: false } }).lean();
    if (!students.length) {
      console.log("No students found. Seed students first.");
      return;
    }

    const periods = lastMonths(MONTHS_BACK);
    const academyIds = [...new Set(students.map((s) => String(s.academy)))];
    const headsByAcademy = new Map();

    for (const academyId of academyIds) {
      await ensureDefaultFeeHeads(academyId);
      await fixAdmissionHeads(academyId);
      const heads = await FeeHead.find({ academy: academyId, isActive: true }).lean();
      headsByAcademy.set(academyId, heads);
    }

    const stats = {
      students: students.length,
      charges: 0,
      payments: 0,
      admissionSkipped: 0,
      admissionPaid: 0,
      admissionUnpaid: 0,
      monthSkipped: 0,
      monthPaid: 0,
      monthUnpaid: 0,
    };

    for (const student of students) {
      const heads = headsByAcademy.get(String(student.academy)) || [];
      await seedStudentFees({ student, heads, periods, stats });
    }

    console.log("\nRandom fee reseed complete");
    console.log(`Periods: ${periods[0]} → ${periods[periods.length - 1]}`);
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Reseed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
