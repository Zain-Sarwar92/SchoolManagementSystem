import crypto from "crypto";
import FeeHead from "../models/FeeHead.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";

export const ONE_TIME_PERIOD_KEY = "ONCE";

export const DEFAULT_FEE_HEADS = [
  {
    name: "Monthly Fee",
    category: "tuition",
    frequency: "monthly",
    description: "Regular monthly tuition",
    defaultAmount: null,
    applicableMonths: [],
  },
  {
    name: "Admission Fee",
    category: "admission",
    frequency: "one_time",
    description: "Paid once per student",
    defaultAmount: 5000,
    applicableMonths: [],
  },
  {
    name: "Generator Dues",
    category: "generator",
    frequency: "monthly",
    description: "Skip winter months via applicable months if not charged year-round",
    defaultAmount: 500,
    // Empty = every month. Academies can restrict e.g. Apr–Oct only.
    applicableMonths: [],
  },
  {
    name: "Test Dues",
    category: "test",
    frequency: "monthly",
    description: "Monthly / exam-related test dues (academy fixed amount)",
    defaultAmount: 300,
    applicableMonths: [],
  },
];

export const isPeriodKey = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));

export const currentPeriodKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export const periodMonth = (periodKey) => Number(String(periodKey).slice(5, 7));

export const feeHeadDueInPeriod = (head, periodKey) => {
  if (head.frequency === "one_time") return true;
  const months = head.applicableMonths || [];
  if (!months.length) return true;
  return months.includes(periodMonth(periodKey));
};

export const chargePeriodKey = (head, periodKey) =>
  head.frequency === "one_time" ? ONE_TIME_PERIOD_KEY : periodKey;

export async function ensureDefaultFeeHeads(academyId) {
  for (const seed of DEFAULT_FEE_HEADS) {
    const existing = await FeeHead.findOne({ academy: academyId, name: seed.name });
    if (existing) {
      // Respect academy delete/deactivate — do not force isActive back on.
      let dirty = false;
      // Keep category/description aligned for system heads (amount/months stay academy-owned).
      if (existing.isActive && existing.category !== seed.category) {
        existing.category = seed.category;
        dirty = true;
      }
      if (existing.isActive && !existing.description && seed.description) {
        existing.description = seed.description;
        dirty = true;
      }
      if (dirty) await existing.save();
      continue;
    }
    await FeeHead.create({
      academy: academyId,
      name: seed.name,
      category: seed.category,
      frequency: seed.frequency,
      description: seed.description,
      defaultAmount: seed.defaultAmount,
      applicableMonths: seed.applicableMonths || [],
      isActive: true,
    });
  }
  return FeeHead.find({ academy: academyId, isActive: true }).sort({ name: 1 }).lean();
}

export function makeReceiptNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RCP-${stamp}-${rand}`;
}

export async function paidAmountForCharge(chargeId) {
  const rows = await FeePaymentAllocation.aggregate([
    { $match: { charge: chargeId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total || 0;
}

export async function paidAmountsForCharges(chargeIds) {
  if (!chargeIds.length) return new Map();
  const rows = await FeePaymentAllocation.aggregate([
    { $match: { charge: { $in: chargeIds } } },
    { $group: { _id: "$charge", total: { $sum: "$amount" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.total]));
}

export function statusFromPaid(amount, paid) {
  const due = Number(amount) || 0;
  const got = Number(paid) || 0;
  if (got <= 0) return "unpaid";
  if (got + 0.001 >= due) return "paid";
  return "partial";
}

export function withBalance(charge, paidMap) {
  const paid = paidMap.get(String(charge._id)) || 0;
  const amount = Number(charge.amount) || 0;
  const balance = Math.max(0, Math.round((amount - paid) * 100) / 100);
  const status =
    charge.status === "waived" ? "waived" : statusFromPaid(amount, paid);
  return {
    ...charge,
    paid,
    balance,
    status,
  };
}
