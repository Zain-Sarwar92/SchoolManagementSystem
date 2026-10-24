import FeeCharge from "../models/FeeCharge.js";
import FeeHead from "../models/FeeHead.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import {
  chargePeriodKey,
  currentPeriodKey,
  ensureDefaultFeeHeads,
  feeHeadDueInPeriod,
  isPeriodKey,
  makeReceiptNumber,
  ONE_TIME_PERIOD_KEY,
  paidAmountForCharge,
  statusFromPaid,
} from "./feeHelpers.js";

const resolveAmount = (head, student, override) => {
  if (override != null && Number.isFinite(Number(override))) return Number(override);
  if (head.name === "Monthly Fee" || head.category === "tuition") {
    return Number(student.monthlyFee) || 0;
  }
  if (head.defaultAmount != null) return Number(head.defaultAmount) || 0;
  return 0;
};

/**
 * Create/find charges and record a full payment for the given fee heads.
 * Used by Fees → Collect and Student add (pay on create).
 */
export async function recordFeeCollection({
  academyId,
  student,
  session,
  periodKey: periodKeyInput,
  method = "cash",
  paidAt = new Date(),
  note = "",
  receivedBy = null,
  /** @type {Array<{ feeHeadName?: string, feeHeadId?: string, amount?: number|null }>} */
  items = [],
}) {
  if (!items.length) {
    const error = new Error("Add at least one fee item to collect");
    error.statusCode = 400;
    throw error;
  }

  await ensureDefaultFeeHeads(academyId);

  const periodKey = String(periodKeyInput || currentPeriodKey()).trim();
  const allocations = [];
  let paymentTotal = 0;

  for (const item of items) {
    let head = null;
    if (item.feeHeadId) {
      head = await FeeHead.findOne({
        _id: item.feeHeadId,
        academy: academyId,
        isActive: true,
      });
    } else if (item.feeHeadName) {
      head = await FeeHead.findOne({
        academy: academyId,
        name: item.feeHeadName,
        isActive: true,
      });
    }
    if (!head) {
      const error = new Error(`Fee type not found: ${item.feeHeadName || item.feeHeadId}`);
      error.statusCode = 404;
      throw error;
    }

    const periodForDue =
      head.frequency === "one_time" ? periodKey || currentPeriodKey() : periodKey;
    if (head.frequency !== "one_time" && !isPeriodKey(periodForDue)) {
      const error = new Error("Period must look like 2026-04");
      error.statusCode = 400;
      throw error;
    }
    if (!feeHeadDueInPeriod(head, periodForDue)) {
      const error = new Error(`${head.name} is not due in ${periodForDue}`);
      error.statusCode = 400;
      throw error;
    }

    const key = chargePeriodKey(head, periodForDue);

    if (head.frequency === "one_time") {
      const paidOnce = await FeeCharge.findOne({
        academy: academyId,
        student: student._id,
        feeHead: head._id,
        status: "paid",
      });
      if (paidOnce) {
        const error = new Error(`${head.name} is already paid`);
        error.statusCode = 400;
        throw error;
      }
    }

    let charge = await FeeCharge.findOne({
      academy: academyId,
      student: student._id,
      feeHead: head._id,
      periodKey: key,
    });

    const amount = resolveAmount(head, student, item.amount);
    if (!(amount > 0)) {
      const error = new Error(`${head.name} amount must be greater than 0`);
      error.statusCode = 400;
      throw error;
    }

    if (!charge) {
      try {
        charge = await FeeCharge.create({
          academy: academyId,
          student: student._id,
          feeHead: head._id,
          session,
          periodKey: key,
          description: head.name,
          amount,
          status: "unpaid",
        });
      } catch (error) {
        if (error?.code === 11000) {
          charge = await FeeCharge.findOne({
            academy: academyId,
            student: student._id,
            feeHead: head._id,
            periodKey: key,
          });
        } else {
          throw error;
        }
      }
    }

    if (charge.status === "waived") {
      const error = new Error(`Cannot pay a waived charge (${head.name})`);
      error.statusCode = 400;
      throw error;
    }

    const alreadyPaid = await paidAmountForCharge(charge._id);
    const balance = Math.max(0, Number(charge.amount) - alreadyPaid);
    if (balance <= 0) {
      const error = new Error(`${head.name} is already paid`);
      error.statusCode = 400;
      throw error;
    }

    // On add we always collect the full remaining balance for the selected heads.
    allocations.push({ charge, amount: balance });
    paymentTotal += balance;
  }

  const receiptNumber = makeReceiptNumber();
  const payment = await FeePayment.create({
    academy: academyId,
    student: student._id,
    receiptNumber,
    amount: Math.round(paymentTotal * 100) / 100,
    method,
    paidAt,
    note,
    receivedBy,
  });

  for (const row of allocations) {
    await FeePaymentAllocation.create({
      payment: payment._id,
      charge: row.charge._id,
      amount: row.amount,
    });
    const paid = await paidAmountForCharge(row.charge._id);
    row.charge.status = statusFromPaid(row.charge.amount, paid);
    await row.charge.save();
  }

  return {
    payment,
    receiptNumber,
    amount: payment.amount,
    periodKey: periodKey || ONE_TIME_PERIOD_KEY,
  };
}
