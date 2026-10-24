/**
 * Live verification of SaaS production blockers for Student + Fee modules.
 * Creates isolated fixtures tagged BLOCKER_TEST_*, runs cases, then cleans up.
 *
 * Usage: node src/scripts/verifyProductionBlockers.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Academy from "../models/Academy.js";
import User from "../models/User.js";
import ClassModel from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import FeeHead from "../models/FeeHead.js";
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";
import StudentSubject from "../models/StudentSubject.js";
import { generateToken } from "../utils/helpers.js";
import { makeReceiptNumber, statusFromPaid } from "../utils/feeHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.resolve(__dirname, "../..");
const MARKER = `blocker-test-${Date.now()}`;
const API = process.env.VERIFY_API_URL || "http://127.0.0.1:5000/api";

const results = [];

function record(blocker, caseId, title, expectedFailMeansConfirmed, passed, detail) {
  const status = passed ? "CONFIRMED" : "NOT REPRODUCED";
  results.push({ blocker, caseId, title, status, detail });
  const icon = passed ? "FAIL→blocker real" : "PASS→safer than claimed";
  console.log(`  [${caseId}] ${title}`);
  console.log(`         ${icon}`);
  console.log(`         ${detail}`);
}

async function refreshChargeStatus(chargeId) {
  const charge = await FeeCharge.findById(chargeId);
  if (!charge) return;
  const rows = await FeePaymentAllocation.aggregate([
    { $match: { charge: charge._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const paid = rows[0]?.total || 0;
  charge.status = statusFromPaid(charge.amount, paid);
  await charge.save();
}

/** Mirrors feeController.recordStudentPayment (no transaction). */
async function collectLikeController({ academyId, student, charge, amount, receivedBy }) {
  const paidRows = await FeePaymentAllocation.aggregate([
    { $match: { charge: charge._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const alreadyPaid = paidRows[0]?.total || 0;
  const balance = Math.max(0, Number(charge.amount) - alreadyPaid);
  if (balance <= 0) {
    const err = new Error("already paid");
    err.code = "ALREADY_PAID";
    throw err;
  }
  if (amount - balance > 0.01) {
    const err = new Error(`exceeds balance ${balance}`);
    err.code = "OVERPAY";
    throw err;
  }

  const payment = await FeePayment.create({
    academy: academyId,
    student: student._id,
    receiptNumber: makeReceiptNumber(),
    amount,
    method: "cash",
    paidAt: new Date(),
    note: MARKER,
    receivedBy,
  });
  await FeePaymentAllocation.create({
    payment: payment._id,
    charge: charge._id,
    amount,
  });
  await refreshChargeStatus(charge._id);
  return payment;
}

async function apiCollect(token, body) {
  const res = await fetch(`${API}/fees/collect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readText(abs) {
  return fs.readFileSync(abs, "utf8");
}

async function cleanup(ids) {
  const {
    academyId,
    userId,
    classId,
    sectionId,
    studentIds,
    headId,
    chargeIds,
  } = ids;

  const payments = await FeePayment.find({ academy: academyId }).select("_id");
  const paymentIds = payments.map((p) => p._id);
  if (paymentIds.length) {
    await FeePaymentAllocation.deleteMany({ payment: { $in: paymentIds } });
  }
  await FeePayment.deleteMany({ academy: academyId });
  await FeeCharge.deleteMany({ academy: academyId });
  await FeeHead.deleteMany({ academy: academyId });
  if (studentIds?.length) {
    await StudentSubject.deleteMany({ student: { $in: studentIds } });
    await Student.deleteMany({ _id: { $in: studentIds } });
  }
  if (sectionId) await Section.deleteOne({ _id: sectionId });
  if (classId) await ClassModel.deleteOne({ _id: classId });
  if (userId) await User.deleteOne({ _id: userId });
  if (academyId) await Academy.deleteOne({ _id: academyId });
  // orphan sweep by marker note
  await FeePayment.deleteMany({ note: MARKER });
  void chargeIds;
  void headId;
}

async function main() {
  console.log("\n=== Production blocker verification ===\n");
  await mongoose.connect(process.env.MONGO_URI);

  const academy = await Academy.create({
    name: "BLOCKER TEST Academy",
    slug: MARKER,
    email: `${MARKER}@test.local`,
    phone: "03001234567",
    address: "Test",
    status: "active",
    plan: "free",
  });

  const user = await User.create({
    name: "Blocker Tester",
    email: `${MARKER}@admin.test`,
    password: "TestPass@12345",
    role: "academy_admin",
    academy: academy._id,
  });

  const schoolClass = await ClassModel.create({
    name: "BT-1",
    gradeLevel: 1,
    academy: academy._id,
  });

  const section = await Section.create({
    name: "A",
    class: schoolClass._id,
    academy: academy._id,
  });

  const studentDefaults = {
    phone: "03001111111",
    gender: "male",
    address: "Addr",
    admissionDate: new Date(),
    monthlyFee: 1000,
    session: "2026-2027",
    academy: academy._id,
    class: schoolClass._id,
    section: section._id,
    major: "arts",
    group: "arts_general",
    isActive: true,
  };

  const studentA = await Student.create({
    ...studentDefaults,
    name: "Blocker Student A",
    fatherName: "Father A",
    rollNumber: `BT-A-${Date.now()}`,
  });

  const studentB = await Student.create({
    ...studentDefaults,
    name: "Blocker Student B",
    fatherName: "Father B",
    phone: "03002222222",
    rollNumber: `BT-B-${Date.now()}`,
  });

  const head = await FeeHead.create({
    academy: academy._id,
    name: "Monthly Fee",
    frequency: "monthly",
    defaultAmount: 1000,
    category: "tuition",
    isActive: true,
  });

  const ids = {
    academyId: academy._id,
    userId: user._id,
    classId: schoolClass._id,
    sectionId: section._id,
    studentIds: [studentA._id, studentB._id],
    headId: head._id,
    chargeIds: [],
  };

  try {
    // ------------------------------------------------------------------
    // BLOCKER 1 — no transactions / concurrent double-pay
    // ------------------------------------------------------------------
    console.log("\n1) Payment transactions missing");
    const chargeRace = await FeeCharge.create({
      academy: academy._id,
      student: studentA._id,
      feeHead: head._id,
      session: "2026-2027",
      periodKey: "2026-10",
      description: "Monthly Fee",
      amount: 1000,
      status: "unpaid",
    });
    ids.chargeIds.push(chargeRace._id);

    // TC1.1: code has no withTransaction
    const feeCtrlPath = path.join(BACKEND, "src/controllers/feeController.js");
    const feeCtrlSrc = readText(feeCtrlPath);
    const hasTxn =
      feeCtrlSrc.includes("withTransaction") || feeCtrlSrc.includes("startSession");
    record(
      1,
      "TC1.1",
      "feeController uses Mongo transaction/session",
      true,
      !hasTxn,
      hasTxn
        ? "Found transaction usage"
        : "No withTransaction/startSession in feeController.js"
    );

    // TC1.2: concurrent full collects both succeed → overpay
    const raceOutcomes = await Promise.allSettled([
      collectLikeController({
        academyId: academy._id,
        student: studentA,
        charge: chargeRace,
        amount: 1000,
        receivedBy: user._id,
      }),
      collectLikeController({
        academyId: academy._id,
        student: studentA,
        charge: chargeRace,
        amount: 1000,
        receivedBy: user._id,
      }),
    ]);
    const raceOk = raceOutcomes.filter((r) => r.status === "fulfilled").length;
    const paidAfter = await FeePaymentAllocation.aggregate([
      { $match: { charge: chargeRace._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalPaid = paidAfter[0]?.total || 0;
    const overpaid = totalPaid > chargeRace.amount + 0.01;
    record(
      1,
      "TC1.2",
      "Two concurrent full-balance collects overpay the charge",
      true,
      overpaid || raceOk === 2,
      `fulfilled=${raceOk}/2, allocated=Rs ${totalPaid} on charge Rs ${chargeRace.amount}` +
        (overpaid ? " → OVERPAID" : raceOk === 2 ? " → both wrote without lock" : "")
    );

    // TC1.3: half-write simulation — payment without allocation
    const orphanPayment = await FeePayment.create({
      academy: academy._id,
      student: studentA._id,
      receiptNumber: makeReceiptNumber(),
      amount: 50,
      method: "cash",
      paidAt: new Date(),
      note: MARKER,
      receivedBy: user._id,
    });
    const allocForOrphan = await FeePaymentAllocation.countDocuments({
      payment: orphanPayment._id,
    });
    record(
      1,
      "TC1.3",
      "Payment can exist without allocations (non-atomic steps)",
      true,
      allocForOrphan === 0,
      `Payment ${orphanPayment.receiptNumber} has ${allocForOrphan} allocation(s) — schema allows orphan receipt`
    );

    // ------------------------------------------------------------------
    // BLOCKER 2 — no idempotency
    // ------------------------------------------------------------------
    console.log("\n2) Idempotency missing");
    const hasIdempotencyHeader =
      feeCtrlSrc.toLowerCase().includes("idempotency") ||
      readText(path.join(BACKEND, "src/routes/feeRoutes.js"))
        .toLowerCase()
        .includes("idempotency");
    record(
      2,
      "TC2.1",
      "Collect endpoint accepts/enforces Idempotency-Key",
      true,
      !hasIdempotencyHeader,
      hasIdempotencyHeader
        ? "Idempotency found in routes/controller"
        : "No Idempotency-Key handling in fee routes/controller"
    );

    const chargeIdem = await FeeCharge.create({
      academy: academy._id,
      student: studentB._id,
      feeHead: head._id,
      session: "2026-2027",
      periodKey: "2026-09",
      description: "Monthly Fee",
      amount: 500,
      status: "unpaid",
    });
    ids.chargeIds.push(chargeIdem._id);

    // Sequential double-submit of partial amounts that together exceed if duplicated
    // Full pay twice: second should fail IF balance check works after first commits
    await collectLikeController({
      academyId: academy._id,
      student: studentB,
      charge: chargeIdem,
      amount: 500,
      receivedBy: user._id,
    });
    let secondRejected = false;
    try {
      await collectLikeController({
        academyId: academy._id,
        student: studentB,
        charge: chargeIdem,
        amount: 500,
        receivedBy: user._id,
      });
    } catch {
      secondRejected = true;
    }
    record(
      2,
      "TC2.2",
      "Sequential double full-pay: second rejected after first commits",
      false,
      !secondRejected,
      secondRejected
        ? "Second sequential submit correctly rejected (balance check works after commit) — race still open; idempotency still missing for retries of SAME in-flight request"
        : "Second sequential submit also wrote — worse than expected"
    );

    // Double-click race of same partial: two concurrent 300 on 500 charge
    const chargeClick = await FeeCharge.create({
      academy: academy._id,
      student: studentB._id,
      feeHead: head._id,
      session: "2026-2027",
      periodKey: "2026-08",
      description: "Monthly Fee",
      amount: 500,
      status: "unpaid",
    });
    ids.chargeIds.push(chargeClick._id);
    const clickOut = await Promise.allSettled([
      collectLikeController({
        academyId: academy._id,
        student: studentB,
        charge: chargeClick,
        amount: 300,
        receivedBy: user._id,
      }),
      collectLikeController({
        academyId: academy._id,
        student: studentB,
        charge: chargeClick,
        amount: 300,
        receivedBy: user._id,
      }),
    ]);
    const clickOk = clickOut.filter((r) => r.status === "fulfilled").length;
    const clickPaid =
      (
        await FeePaymentAllocation.aggregate([
          { $match: { charge: chargeClick._id } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
      )[0]?.total || 0;
    const receipts = await FeePayment.countDocuments({
      academy: academy._id,
      student: studentB._id,
      note: MARKER,
      amount: 300,
    });
    record(
      2,
      "TC2.3",
      "Double-click concurrent partial (300+300 on Rs 500)",
      true,
      clickOk === 2 && clickPaid > 500,
      `receipts_with_300≈${receipts}, fulfilled=${clickOk}/2, allocated=Rs ${clickPaid} (charge Rs 500)`
    );

    // Live API double-submit if server up
    let apiReachable = false;
    try {
      const token = generateToken(user._id);
      const chargeApi = await FeeCharge.create({
        academy: academy._id,
        student: studentA._id,
        feeHead: head._id,
        session: "2026-2027",
        periodKey: "2026-07",
        description: "Monthly Fee",
        amount: 800,
        status: "unpaid",
      });
      ids.chargeIds.push(chargeApi._id);
      const body = {
        studentId: String(studentA._id),
        session: "2026-2027",
        method: "cash",
        items: [{ chargeId: String(chargeApi._id), amount: 400 }],
      };
      const [a, b] = await Promise.all([
        apiCollect(token, body),
        apiCollect(token, body),
      ]);
      apiReachable = true;
      const apiOk = [a, b].filter((r) => r.status === 201).length;
      const apiPaid =
        (
          await FeePaymentAllocation.aggregate([
            { $match: { charge: chargeApi._id } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ])
        )[0]?.total || 0;
      record(
        2,
        "TC2.4",
        "Live API concurrent POST /fees/collect (no Idempotency-Key)",
        true,
        apiOk === 2 || apiPaid > 800,
        `HTTP ${a.status}/${b.status}, allocated=Rs ${apiPaid} on Rs 800` +
          (apiOk === 2 ? " → two 201 responses" : "")
      );
    } catch (err) {
      record(
        2,
        "TC2.4",
        "Live API concurrent POST /fees/collect",
        true,
        false,
        `API not exercised (${err.message}). DB race tests above still apply.`
      );
    }

    // ------------------------------------------------------------------
    // BLOCKER 3 — student hard delete orphans fee history
    // ------------------------------------------------------------------
    console.log("\n3) Student hard delete orphans fee history");
    const delStudent = await Student.create({
      ...studentDefaults,
      name: "Blocker Delete Me",
      fatherName: "Father D",
      phone: "03003333333",
      rollNumber: `BT-D-${Date.now()}`,
      isActive: false,
    });
    ids.studentIds.push(delStudent._id);

    const delCharge = await FeeCharge.create({
      academy: academy._id,
      student: delStudent._id,
      feeHead: head._id,
      session: "2026-2027",
      periodKey: "2026-06",
      description: "Monthly Fee",
      amount: 1000,
      status: "paid",
    });
    const delPay = await FeePayment.create({
      academy: academy._id,
      student: delStudent._id,
      receiptNumber: makeReceiptNumber(),
      amount: 1000,
      method: "cash",
      paidAt: new Date(),
      note: MARKER,
      receivedBy: user._id,
    });
    await FeePaymentAllocation.create({
      payment: delPay._id,
      charge: delCharge._id,
      amount: 1000,
    });

    // Mirror deleteStudent controller
    await StudentSubject.deleteMany({ student: delStudent._id });
    await delStudent.deleteOne();

    const orphanCharges = await FeeCharge.countDocuments({ student: delStudent._id });
    const orphanPays = await FeePayment.countDocuments({ student: delStudent._id });
    const orphanAllocs = await FeePaymentAllocation.countDocuments({
      payment: delPay._id,
    });
    const deleteSrc = readText(path.join(BACKEND, "src/controllers/studentController.js"));
    const deleteFn = deleteSrc.slice(
      deleteSrc.indexOf("export const deleteStudent"),
      deleteSrc.indexOf("export const promoteStudent")
    );
    const cascadesFees =
      deleteFn.includes("FeeCharge") ||
      deleteFn.includes("FeePayment") ||
      deleteFn.includes("FeePaymentAllocation");

    record(
      3,
      "TC3.1",
      "deleteStudent cascades or blocks on fee docs",
      true,
      !cascadesFees,
      cascadesFees
        ? "deleteStudent references fee models"
        : "deleteStudent only removes StudentSubject + student"
    );
    record(
      3,
      "TC3.2",
      "After hard delete, FeeCharge/FeePayment/allocations remain",
      true,
      orphanCharges > 0 && orphanPays > 0 && orphanAllocs > 0,
      `charges=${orphanCharges}, payments=${orphanPays}, allocations=${orphanAllocs} still pointing at deleted student ${delStudent._id}`
    );

    // ------------------------------------------------------------------
    // BLOCKER 4 — no receipt print/PDF
    // ------------------------------------------------------------------
    console.log("\n4) Receipt print/PDF missing");
    const collectPage = path.join(
      ROOT,
      "frontend/src/pages/AcademyFeeCollectStudent.jsx"
    );
    const collectSrc = readText(collectPage);
    const appSrc = readText(path.join(ROOT, "frontend/src/App.jsx"));
    const hasReceiptRoute =
      /fees\/receipt|FeeReceipt|receipt\/print/i.test(appSrc) ||
      fileExists("frontend/src/pages/AcademyFeeReceiptPrint.jsx") ||
      fileExists("frontend/src/pages/FeeReceipt.jsx");
    const collectHasPrint =
      collectSrc.includes("window.print") ||
      /receipt.*print|print.*receipt/i.test(collectSrc);
    const onlyToast =
      collectSrc.includes("toast.success") && !collectHasPrint && !hasReceiptRoute;
    const pdfLib =
      fs.existsSync(path.join(ROOT, "frontend/package.json")) &&
      /jspdf|pdfkit|react-pdf|@react-pdf/i.test(
        readText(path.join(ROOT, "frontend/package.json"))
      );

    record(
      4,
      "TC4.1",
      "Dedicated receipt print page/route exists",
      true,
      !hasReceiptRoute,
      hasReceiptRoute ? "Receipt route/page found" : "No fee receipt print route/page"
    );
    record(
      4,
      "TC4.2",
      "Collect UI only toasts success (no print receipt)",
      true,
      onlyToast,
      onlyToast
        ? "AcademyFeeCollectStudent uses toast.success only after collect"
        : "Collect page has some print/receipt UI"
    );
    record(
      4,
      "TC4.3",
      "PDF library present for receipts",
      true,
      !pdfLib,
      pdfLib ? "PDF dependency found in frontend" : "No jspdf/pdfkit/react-pdf in frontend deps"
    );

    // ------------------------------------------------------------------
    // BLOCKER 5 — zero automated tests
    // ------------------------------------------------------------------
    console.log("\n5) Automated tests zero");
    const backendPkg = JSON.parse(readText(path.join(BACKEND, "package.json")));
    const frontendPkgPath = path.join(ROOT, "frontend/package.json");
    const frontendPkg = fs.existsSync(frontendPkgPath)
      ? JSON.parse(readText(frontendPkgPath))
      : {};
    const hasTestScript = Boolean(backendPkg.scripts?.test || frontendPkg.scripts?.test);
    const appTestFiles = [];
    for (const dir of [
      path.join(BACKEND, "src"),
      path.join(ROOT, "frontend/src"),
    ]) {
      if (!fs.existsSync(dir)) continue;
      const walk = (d) => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(ent.name)) appTestFiles.push(p);
        }
      };
      walk(dir);
    }
    record(
      5,
      "TC5.1",
      "package.json has test script (backend or frontend)",
      true,
      !hasTestScript,
      hasTestScript ? "test script exists" : "No test script in backend/frontend package.json"
    );
    record(
      5,
      "TC5.2",
      "App source has *.test.* / *.spec.* files",
      true,
      appTestFiles.length === 0,
      appTestFiles.length
        ? `Found ${appTestFiles.length} test file(s)`
        : "Zero test files under backend/src or frontend/src"
    );

    // ------------------------------------------------------------------
    // BLOCKER 6 — SaaS plan not enforced
    // ------------------------------------------------------------------
    console.log("\n6) SaaS plan (free/basic/pro) not enforced");
    const middlewareDir = path.join(BACKEND, "src/middleware");
    const controllersDir = path.join(BACKEND, "src/controllers");
    let planGuardHits = 0;
    const scanDirs = [middlewareDir, controllersDir, path.join(BACKEND, "src/routes")];
    for (const dir of scanDirs) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!ent.isFile() || !ent.name.endsWith(".js")) continue;
        const src = readText(path.join(dir, ent.name));
        if (
          /requirePlan|checkPlan|plan\s*===|plan\s*!==|\.plan\b/.test(src) &&
          !ent.name.includes("validate") // schema only
        ) {
          // Academy model / academyController setting plan doesn't count as enforcement
          if (
            ent.name === "academyController.js" ||
            ent.name === "Academy.js"
          ) {
            continue;
          }
          if (/(student|fee|auth)/i.test(ent.name) || /plan/.test(src)) {
            if (
              /free|basic|pro/.test(src) &&
              /(student|fee|limit|upgrade|forbid|403|plan)/i.test(src)
            ) {
              planGuardHits += 1;
            }
          }
        }
      }
    }

    // More precise: student + fee controllers never read academy.plan
    const studentCtrl = readText(
      path.join(BACKEND, "src/controllers/studentController.js")
    );
    const feeCtrl = feeCtrlSrc;
    const authMw = readText(path.join(BACKEND, "src/middleware/auth.js"));
    const studentUsesPlan = /\.plan\b|plan\s*===/.test(studentCtrl);
    const feeUsesPlan = /\.plan\b|plan\s*===/.test(feeCtrl);
    const authUsesPlan = /\.plan\b|plan\s*===/.test(authMw);

    // Behavioral: free plan academy can still create student + charge (we just did)
    const freeCanCreate =
      academy.plan === "free" &&
      (await Student.countDocuments({ academy: academy._id })) > 0 &&
      (await FeeCharge.countDocuments({ academy: academy._id })) > 0;

    record(
      6,
      "TC6.1",
      "studentController / feeController / auth enforce academy.plan",
      true,
      !studentUsesPlan && !feeUsesPlan && !authUsesPlan,
      `student.plan=${studentUsesPlan}, fee.plan=${feeUsesPlan}, auth.plan=${authUsesPlan}`
    );
    record(
      6,
      "TC6.2",
      "Free-plan academy can still create students + fee charges",
      true,
      freeCanCreate,
      freeCanCreate
        ? `plan=free but created students+charges under academy ${academy.slug}`
        : "Could not create under free plan"
    );
    record(
      6,
      "TC6.3",
      "Academy.plan field exists but is not used as a gate",
      true,
      academy.plan === "free" && !studentUsesPlan && !feeUsesPlan && !authUsesPlan,
      `Stored plan="${academy.plan}" with no gates on student/fee/auth — decorative only`
    );

    void apiReachable;
    void planGuardHits;
  } finally {
    console.log("\nCleaning up test fixtures…");
    await cleanup(ids);
    await mongoose.disconnect();
  }

  // Summary
  console.log("\n=== SUMMARY ===\n");
  const byBlocker = new Map();
  for (const r of results) {
    if (!byBlocker.has(r.blocker)) byBlocker.set(r.blocker, []);
    byBlocker.get(r.blocker).push(r);
  }
  for (const [b, cases] of byBlocker) {
    const confirmed = cases.filter((c) => c.status === "CONFIRMED").length;
    const not = cases.filter((c) => c.status === "NOT REPRODUCED").length;
    console.log(
      `Blocker ${b}: ${confirmed} confirmed, ${not} not reproduced (${cases.length} cases)`
    );
  }
  console.log("\nLegend: CONFIRMED = blocker is real for that case.");
  console.log(
    "        NOT REPRODUCED = safer than claimed OR case did not prove the gap.\n"
  );
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
