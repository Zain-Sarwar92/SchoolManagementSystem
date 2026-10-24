import mongoose from "mongoose";
import Class from "../models/Class.js";
import FeeCharge from "../models/FeeCharge.js";
import FeeHead from "../models/FeeHead.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import { resolveSession } from "../utils/academicSession.js";
import {
  chargePeriodKey,
  ensureDefaultFeeHeads,
  feeHeadDueInPeriod,
  isPeriodKey,
  makeReceiptNumber,
  ONE_TIME_PERIOD_KEY,
  paidAmountsForCharges,
  statusFromPaid,
  withBalance,
} from "../utils/feeHelpers.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

/** Accept array, comma-separated string, or single id. */
const parseIdList = (...sources) => {
  const out = [];
  for (const source of sources) {
    if (source == null || source === "") continue;
    const parts = Array.isArray(source) ? source : String(source).split(",");
    for (const part of parts) {
      const id = String(part || "").trim();
      if (id && !out.includes(id)) out.push(id);
    }
  }
  return out;
};

const resolveChargeAmount = (head, student) => {
  if (head.name === "Monthly Fee" || head.category === "tuition") {
    return Number(student.monthlyFee) || 0;
  }
  // Generator / admission / other fixed heads use academy defaultAmount.
  if (head.defaultAmount != null) return Number(head.defaultAmount) || 0;
  return 0;
};

async function refreshChargeStatus(chargeId) {
  const charge = await FeeCharge.findById(chargeId);
  if (!charge || charge.status === "waived") return charge;

  const rows = await FeePaymentAllocation.aggregate([
    { $match: { charge: charge._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const paid = rows[0]?.total || 0;
  charge.status = statusFromPaid(charge.amount, paid);
  await charge.save();
  return charge;
}

export const listFeeHeads = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const heads = await ensureDefaultFeeHeads(academyId);
  res.json({ success: true, count: heads.length, heads });
});

export const createFeeHead = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = req.body.name.trim();

  const existing = await FeeHead.findOne({
    academy: academyId,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
  });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      if (req.body.category) existing.category = req.body.category;
      if (req.body.frequency) existing.frequency = req.body.frequency;
      if (req.body.description !== undefined) {
        existing.description = req.body.description || "";
      }
      if (req.body.defaultAmount !== undefined) {
        existing.defaultAmount = req.body.defaultAmount;
      }
      await existing.save();
      return res.status(200).json({
        success: true,
        message: "Fee type restored",
        head: existing,
      });
    }
    res.status(400);
    throw new Error("Fee type already exists");
  }

  const head = await FeeHead.create({
    academy: academyId,
    name,
    category: req.body.category,
    frequency: req.body.frequency,
    description: req.body.description || "",
    defaultAmount: req.body.defaultAmount ?? null,
    applicableMonths: req.body.applicableMonths || [],
  });

  res.status(201).json({
    success: true,
    message: "Fee type created",
    head,
  });
});

export const deleteFeeHead = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const head = await FeeHead.findOne({ _id: req.params.id, academy: academyId });
  if (!head) {
    res.status(404);
    throw new Error("Fee type not found");
  }

  if (head.name === "Monthly Fee" || head.category === "tuition") {
    res.status(400);
    throw new Error("Monthly Fee cannot be deleted");
  }

  // Soft-delete so payment history stays linked; list/generate hide inactive heads.
  head.isActive = false;
  await head.save();

  res.json({
    success: true,
    message: "Fee type deleted",
  });
});

export const updateFeeHead = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const head = await FeeHead.findOne({ _id: req.params.id, academy: academyId });
  if (!head) {
    res.status(404);
    throw new Error("Fee type not found");
  }

  const amountChanged =
    req.body.defaultAmount !== undefined &&
    Number(req.body.defaultAmount) !== Number(head.defaultAmount);

  if (req.body.name) head.name = req.body.name.trim();
  if (req.body.category) head.category = req.body.category;
  if (req.body.frequency) head.frequency = req.body.frequency;
  if (req.body.description !== undefined) head.description = req.body.description || "";
  if (req.body.defaultAmount !== undefined) head.defaultAmount = req.body.defaultAmount;
  if (req.body.isActive !== undefined) head.isActive = req.body.isActive;

  const isGenerator = head.name === "Generator Dues" || head.category === "generator";
  if (isGenerator && req.body.applicableMonths !== undefined) {
    head.applicableMonths = req.body.applicableMonths || [];
  } else if (!isGenerator) {
    // Month limits are Generator-only.
    head.applicableMonths = [];
  }

  await head.save();

  let syncedOpenCharges = 0;
  if (amountChanged && head.defaultAmount != null && Number(head.defaultAmount) >= 0) {
    const result = await FeeCharge.updateMany(
      {
        academy: academyId,
        feeHead: head._id,
        status: "unpaid",
      },
      { $set: { amount: Number(head.defaultAmount) } }
    );
    syncedOpenCharges = result.modifiedCount || 0;
  }

  res.json({
    success: true,
    message:
      syncedOpenCharges > 0
        ? `Fee type updated · ${syncedOpenCharges} unpaid charge(s) synced`
        : "Fee type updated",
    head,
    syncedOpenCharges,
  });
});

export const getFeeSummary = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.query.session);
  const periodKey = String(req.query.periodKey || "").trim();

  const chargeFilter = { academy: academyId, session };
  if (periodKey) {
    if (!isPeriodKey(periodKey) && periodKey !== ONE_TIME_PERIOD_KEY) {
      res.status(400);
      throw new Error("Period must look like 2026-04");
    }
    chargeFilter.periodKey = { $in: [periodKey, ONE_TIME_PERIOD_KEY] };
  }

  const charges = await FeeCharge.find(chargeFilter).select("_id amount status").lean();
  const paidMap = await paidAmountsForCharges(charges.map((c) => c._id));

  let billed = 0;
  let collected = 0;
  let outstanding = 0;
  let unpaidCount = 0;
  let paidCount = 0;

  for (const charge of charges) {
    if (charge.status === "waived") continue;
    const paid = paidMap.get(String(charge._id)) || 0;
    const amount = Number(charge.amount) || 0;
    billed += amount;
    collected += Math.min(paid, amount);
    const balance = Math.max(0, amount - paid);
    outstanding += balance;
    if (balance > 0) unpaidCount += 1;
    else paidCount += 1;
  }

  res.json({
    success: true,
    summary: {
      session,
      periodKey: periodKey || null,
      billed: Math.round(billed),
      collected: Math.round(collected),
      outstanding: Math.round(outstanding),
      unpaidCount,
      paidCount,
      chargeCount: charges.length,
    },
  });
});

export const generateFeeCharges = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.body.session);
  const periodKey = String(req.body.periodKey || "").trim();
  if (!isPeriodKey(periodKey)) {
    res.status(400);
    throw new Error("Period must look like 2026-04");
  }

  await ensureDefaultFeeHeads(academyId);

  const feeHeadIds = parseIdList(req.body.feeHeadIds, req.body.feeHeadId);
  const classIds = parseIdList(req.body.classIds, req.body.classId);
  const sectionIds = parseIdList(req.body.sectionIds, req.body.sectionId);

  // Default generate = Monthly Fee only (admission / one-time is opt-in via feeHeadId).
  const headFilter = {
    academy: academyId,
    isActive: true,
  };
  if (feeHeadIds.length) {
    headFilter._id = { $in: feeHeadIds };
  } else {
    headFilter.name = "Monthly Fee";
  }

  const heads = await FeeHead.find(headFilter).lean();

  if (!heads.length) {
    res.status(400);
    throw new Error("No active fee types found");
  }

  const studentFilter = {
    academy: academyId,
    session,
    isActive: true,
  };
  if (classIds.length) studentFilter.class = { $in: classIds };
  if (sectionIds.length) studentFilter.section = { $in: sectionIds };

  if (classIds.length) {
    const count = await Class.countDocuments({
      _id: { $in: classIds },
      academy: academyId,
    });
    if (count !== classIds.length) {
      res.status(404);
      throw new Error("One or more classes not found");
    }
  }
  if (sectionIds.length) {
    const sectionDocs = await Section.find({
      _id: { $in: sectionIds },
      academy: academyId,
    })
      .select("_id class")
      .lean();
    if (sectionDocs.length !== sectionIds.length) {
      res.status(404);
      throw new Error("One or more sections not found");
    }
    if (classIds.length) {
      const classSet = new Set(classIds.map(String));
      const mismatch = sectionDocs.some((s) => !classSet.has(String(s.class)));
      if (mismatch) {
        res.status(400);
        throw new Error("Section does not belong to selected class");
      }
    }
  }

  const students = await Student.find(studentFilter)
    .select("_id monthlyFee name")
    .lean();

  if (!students.length) {
    res.status(400);
    throw new Error("No active students match this scope");
  }

  const dueDate = req.body.dueDate ? new Date(`${req.body.dueDate}T00:00:00.000Z`) : null;

  let created = 0;
  let skipped = 0;
  let zeroAmount = 0;

  for (const student of students) {
    for (const head of heads) {
      if (!feeHeadDueInPeriod(head, periodKey)) {
        skipped += 1;
        continue;
      }

      const key = chargePeriodKey(head, periodKey);
      if (head.frequency === "one_time") {
        const already = await FeeCharge.findOne({
          academy: academyId,
          student: student._id,
          feeHead: head._id,
        }).select("_id");
        if (already) {
          skipped += 1;
          continue;
        }
      }

      const amount = resolveChargeAmount(head, student);
      if (amount <= 0) {
        zeroAmount += 1;
        continue;
      }

      try {
        await FeeCharge.create({
          academy: academyId,
          student: student._id,
          feeHead: head._id,
          session,
          periodKey: key,
          description: head.name,
          amount,
          dueDate,
          status: "unpaid",
        });
        created += 1;
      } catch (error) {
        if (error?.code === 11000) skipped += 1;
        else throw error;
      }
    }
  }

  res.status(201).json({
    success: true,
    message: `Created ${created} dues for ${students.length} student(s). Skipped ${skipped} existing / not due. Ignored ${zeroAmount} zero-amount rows.`,
    created,
    skipped,
    zeroAmount,
    studentCount: students.length,
  });
});

export const listDues = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.query.session);
  const status = String(req.query.status || "").trim();
  const periodKey = String(req.query.periodKey || "").trim();
  const q = String(req.query.q || "").trim();

  const filter = { academy: academyId, session };
  if (periodKey) {
    if (!isPeriodKey(periodKey) && periodKey !== ONE_TIME_PERIOD_KEY) {
      res.status(400);
      throw new Error("Period must look like 2026-04");
    }
    // Monthly view also includes one-time (Admission) dues so they stay visible.
    if (periodKey === ONE_TIME_PERIOD_KEY) {
      filter.periodKey = ONE_TIME_PERIOD_KEY;
    } else {
      filter.periodKey = { $in: [periodKey, ONE_TIME_PERIOD_KEY] };
    }
  }
  const feeHeadIds = parseIdList(req.query.feeHeadIds, req.query.feeHeadId);
  const classIds = parseIdList(req.query.classIds, req.query.classId);
  const sectionIds = parseIdList(req.query.sectionIds, req.query.sectionId);
  const statusList = parseIdList(req.query.statuses, status);

  if (feeHeadIds.length) {
    filter.feeHead = { $in: feeHeadIds };
  }
  if (statusList.length && !statusList.includes("all")) {
    const expanded = new Set();
    for (const item of statusList) {
      if (item === "open") {
        expanded.add("unpaid");
        expanded.add("partial");
      } else {
        expanded.add(item);
      }
    }
    filter.status = { $in: [...expanded] };
  }

  let studentIds = null;
  if (classIds.length || sectionIds.length || q) {
    const studentFilter = { academy: academyId, session };
    if (classIds.length) studentFilter.class = { $in: classIds };
    if (sectionIds.length) studentFilter.section = { $in: sectionIds };
    if (q) {
      const needle = new RegExp(escapeRegex(q), "i");
      studentFilter.$or = [
        { name: needle },
        { fatherName: needle },
        { rollNumber: needle },
        { phone: needle },
      ];
    }
    const students = await Student.find(studentFilter).select("_id").lean();
    studentIds = students.map((s) => s._id);
    if (!studentIds.length) {
      return res.json({ success: true, count: 0, dues: [] });
    }
    filter.student = { $in: studentIds };
  }

  const charges = await FeeCharge.find(filter)
    .populate("feeHead", "name category frequency")
    .populate({
      path: "student",
      select: "name fatherName rollNumber phone monthlyFee class section session isActive",
      populate: [
        { path: "class", select: "name gradeLevel" },
        { path: "section", select: "name" },
      ],
    })
    .sort({ periodKey: -1, createdAt: -1 })
    .limit(500)
    .lean();

  const paidMap = await paidAmountsForCharges(charges.map((c) => c._id));
  const wantsOpen =
    statusList.includes("open") ||
    (statusList.length === 0 && status === "open");
  const dues = charges
    .map((charge) => withBalance(charge, paidMap))
    .filter((row) => {
      if (wantsOpen && statusList.length <= 1) {
        return row.balance > 0 && row.status !== "waived";
      }
      return true;
    });

  res.json({ success: true, count: dues.length, dues });
});

export const getStudentLedger = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.query.session);
  const student = await Student.findOne({
    _id: req.params.studentId,
    academy: academyId,
  })
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .lean();

  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  await ensureDefaultFeeHeads(academyId);

  // Full history for this student (all sessions) so "fees submitted so far" is complete.
  const charges = await FeeCharge.find({
    academy: academyId,
    student: student._id,
  })
    .populate("feeHead", "name category frequency")
    .sort({ session: -1, periodKey: -1, createdAt: -1 })
    .lean();

  const payments = await FeePayment.find({
    academy: academyId,
    student: student._id,
  })
    .sort({ paidAt: -1 })
    .limit(100)
    .lean();

  const paidMap = await paidAmountsForCharges(charges.map((c) => c._id));
  const dues = charges.map((charge) => withBalance(charge, paidMap));

  const allocRows = payments.length
    ? await FeePaymentAllocation.find({
        payment: { $in: payments.map((p) => p._id) },
      })
        .populate({
          path: "charge",
          select: "periodKey session description amount status feeHead",
          populate: { path: "feeHead", select: "name category" },
        })
        .lean()
    : [];

  const allocByPayment = new Map();
  for (const row of allocRows) {
    const key = String(row.payment);
    if (!allocByPayment.has(key)) allocByPayment.set(key, []);
    allocByPayment.get(key).push({
      amount: row.amount,
      periodKey: row.charge?.periodKey || "",
      session: row.charge?.session || "",
      feeName: row.charge?.feeHead?.name || row.charge?.description || "Fee",
      chargeStatus: row.charge?.status || "",
    });
  }

  const paymentsWithItems = payments.map((payment) => ({
    ...payment,
    items: allocByPayment.get(String(payment._id)) || [],
  }));

  const sessionCharges = dues.filter((d) => d.session === session);
  const outstanding = sessionCharges
    .filter((d) => d.status !== "waived")
    .reduce((sum, d) => sum + d.balance, 0);
  const submitted = dues.filter((d) => d.paid > 0);
  const totalPaid = submitted.reduce((sum, d) => sum + (Number(d.paid) || 0), 0);

  res.json({
    success: true,
    student,
    session,
    outstanding: Math.round(outstanding),
    totalPaid: Math.round(totalPaid),
    charges: dues,
    sessionCharges,
    submitted,
    payments: paymentsWithItems,
  });
});

async function buildCollectAllocations({
  academyId,
  student,
  sessionLabel,
  items,
}) {
  const allocations = [];
  let paymentTotal = 0;

  for (const item of items) {
    const payAmount = Number(item.amount);
    if (!(payAmount > 0)) {
      const error = new Error("Payment amount must be positive");
      error.statusCode = 400;
      throw error;
    }

    let charge;
    if (item.chargeId) {
      charge = await FeeCharge.findOne({
        _id: item.chargeId,
        academy: academyId,
        student: student._id,
      });
      if (!charge) {
        const error = new Error("Fee charge not found");
        error.statusCode = 404;
        throw error;
      }
      if (charge.status === "waived") {
        const error = new Error("Cannot pay a waived charge");
        error.statusCode = 400;
        throw error;
      }
    } else {
      const head = await FeeHead.findOne({
        _id: item.feeHeadId,
        academy: academyId,
        isActive: true,
      });
      if (!head) {
        const error = new Error("Fee type not found");
        error.statusCode = 404;
        throw error;
      }

      const periodKeyRaw = String(item.periodKey || "").trim();
      if (head.frequency !== "one_time" && !isPeriodKey(periodKeyRaw)) {
        const error = new Error("Period must look like 2026-04");
        error.statusCode = 400;
        throw error;
      }
      if (!feeHeadDueInPeriod(head, periodKeyRaw || currentFallbackPeriod())) {
        const error = new Error(`${head.name} is not due in this period`);
        error.statusCode = 400;
        throw error;
      }

      const key = chargePeriodKey(head, periodKeyRaw || ONE_TIME_PERIOD_KEY);

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

      charge = await FeeCharge.findOne({
        academy: academyId,
        student: student._id,
        feeHead: head._id,
        periodKey: key,
      });

      if (!charge) {
        const amount = resolveChargeAmount(head, student) || payAmount;
        try {
          charge = await FeeCharge.create({
            academy: academyId,
            student: student._id,
            feeHead: head._id,
            session: sessionLabel,
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
    }

    const paidRows = await FeePaymentAllocation.aggregate([
      { $match: { charge: charge._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const alreadyPaid = paidRows[0]?.total || 0;
    const balance = Math.max(0, Number(charge.amount) - alreadyPaid);
    if (balance <= 0) {
      const error = new Error(`${charge.description || "Charge"} is already paid`);
      error.statusCode = 400;
      throw error;
    }
    if (payAmount - balance > 0.01) {
      const error = new Error(
        `Amount exceeds balance (Rs ${balance}) for ${charge.description || "charge"}`
      );
      error.statusCode = 400;
      throw error;
    }

    allocations.push({ charge, amount: payAmount });
    paymentTotal += payAmount;
  }

  return { allocations, paymentTotal: Math.round(paymentTotal * 100) / 100 };
}

async function recordStudentPayment({
  academyId,
  student,
  sessionLabel,
  method,
  paidAt,
  note,
  receivedBy,
  items,
}) {
  const { allocations, paymentTotal } = await buildCollectAllocations({
    academyId,
    student,
    sessionLabel,
    items,
  });

  const receiptNumber = makeReceiptNumber();
  const payment = await FeePayment.create({
    academy: academyId,
    student: student._id,
    receiptNumber,
    amount: paymentTotal,
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
    await refreshChargeStatus(row.charge._id);
  }

  return { payment, receiptNumber, amount: paymentTotal, itemCount: allocations.length };
}

export const collectFee = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const sessionLabel = resolveSession(req.body.session);
  const studentId = req.body.studentId;
  const method = req.body.method || "cash";
  const note = req.body.note || "";
  const paidAt = req.body.paidAt ? new Date(`${req.body.paidAt}T12:00:00.000Z`) : new Date();
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (!items.length) {
    res.status(400);
    throw new Error("Add at least one fee item to collect");
  }

  const student = await Student.findOne({
    _id: studentId,
    academy: academyId,
    isActive: true,
  });
  if (!student) {
    res.status(404);
    throw new Error("Active student not found");
  }

  await ensureDefaultFeeHeads(academyId);

  try {
    const result = await recordStudentPayment({
      academyId,
      student,
      sessionLabel,
      method,
      paidAt,
      note,
      receivedBy: req.user._id,
      items,
    });

    const populated = await FeePayment.findById(result.payment._id)
      .populate("student", "name rollNumber fatherName")
      .lean();

    res.status(201).json({
      success: true,
      message: `Collected Rs ${result.amount}. Receipt ${result.receiptNumber}`,
      payment: populated,
      receiptNumber: result.receiptNumber,
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    throw error;
  }
});

function currentFallbackPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const waiveCharge = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const charge = await FeeCharge.findOne({ _id: req.params.id, academy: academyId });
  if (!charge) {
    res.status(404);
    throw new Error("Charge not found");
  }

  const paidMap = await paidAmountsForCharges([charge._id]);
  const paid = paidMap.get(String(charge._id)) || 0;
  if (paid > 0) {
    res.status(400);
    throw new Error("Cannot waive a charge that already has payments");
  }

  charge.status = "waived";
  await charge.save();

  res.json({ success: true, message: "Charge waived", charge });
});

export const searchFeeStudents = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.query.session);
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 1) {
    return res.json({ success: true, count: 0, students: [] });
  }

  const needle = new RegExp(escapeRegex(q), "i");
  const filter = {
    academy: academyId,
    session,
    isActive: true,
    $or: [{ name: needle }, { fatherName: needle }, { rollNumber: needle }, { phone: needle }],
  };
  const classIds = parseIdList(req.query.classIds, req.query.classId);
  const sectionIds = parseIdList(req.query.sectionIds, req.query.sectionId);
  if (classIds.length) filter.class = { $in: classIds };
  if (sectionIds.length) filter.section = { $in: sectionIds };

  const students = await Student.find(filter)
    .select("name fatherName rollNumber phone monthlyFee class section")
    .populate("class", "name")
    .populate("section", "name")
    .sort({ rollNumber: 1 })
    .limit(30)
    .lean();

  const studentIds = students.map((s) => s._id);
  const openCharges = await FeeCharge.find({
    academy: toObjectId(academyId) || academyId,
    student: { $in: studentIds },
    session,
    status: { $in: ["unpaid", "partial"] },
  })
    .select("_id student amount status")
    .lean();

  const paidMap = await paidAmountsForCharges(openCharges.map((c) => c._id));
  const outstandingByStudent = new Map();
  for (const charge of openCharges) {
    const paid = paidMap.get(String(charge._id)) || 0;
    const balance = Math.max(0, Number(charge.amount) - paid);
    const key = String(charge.student);
    outstandingByStudent.set(key, (outstandingByStudent.get(key) || 0) + balance);
  }

  res.json({
    success: true,
    count: students.length,
    students: students.map((student) => ({
      ...student,
      outstanding: Math.round(outstandingByStudent.get(String(student._id)) || 0),
    })),
  });
});
