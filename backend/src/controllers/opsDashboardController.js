import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import StudentMark from "../models/StudentMark.js";
import { currentAcademicSession, resolveSession } from "../utils/academicSession.js";
import { paidAmountsForCharges } from "../utils/feeHelpers.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * GET /api/academies/me/ops-dashboard
 * Daily ops control panel for academy admins.
 */
export const getOpsDashboard = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(
    req.query.session || currentAcademicSession()
  );

  const dayStart = startOfLocalDay();
  const dayEnd = endOfLocalDay();

  const [
    sections,
    studentCounts,
    totalStudents,
    charges,
    todayPayments,
    exams,
  ] = await Promise.all([
    Section.find({ academy: academyId, isActive: true })
      .populate("class", "name gradeLevel isActive")
      .sort({ name: 1 })
      .lean(),
    Student.aggregate([
      {
        $match: {
          academy: academyId,
          isActive: true,
          session,
        },
      },
      { $group: { _id: "$section", count: { $sum: 1 } } },
    ]),
    Student.countDocuments({
      academy: academyId,
      isActive: true,
      session,
    }),
    FeeCharge.find({
      academy: academyId,
      session,
      status: { $ne: "waived" },
    })
      .select("_id student amount status")
      .populate("student", "name rollNumber section class isActive")
      .lean(),
    FeePayment.find({
      academy: academyId,
      paidAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select("amount paidAt receiptNumber student method")
      .populate("student", "name rollNumber")
      .sort({ paidAt: -1 })
      .lean(),
    ExamTerm.find({ academy: academyId, session })
      .sort({ examDate: 1, createdAt: 1, name: 1 })
      .lean(),
  ]);

  const countBySection = new Map(
    studentCounts.map((row) => [String(row._id), row.count])
  );

  // —— Students by class / section ——
  const byClass = new Map();
  for (const section of sections) {
    const klass = section.class;
    if (!klass || klass.isActive === false) continue;
    const classId = String(klass._id);
    if (!byClass.has(classId)) {
      byClass.set(classId, {
        _id: klass._id,
        name: klass.name,
        gradeLevel: klass.gradeLevel,
        studentCount: 0,
        sections: [],
      });
    }
    const bucket = byClass.get(classId);
    const n = countBySection.get(String(section._id)) || 0;
    bucket.studentCount += n;
    bucket.sections.push({
      _id: section._id,
      name: section.name,
      studentCount: n,
    });
  }
  const classes = [...byClass.values()]
    .map((klass) => ({
      ...klass,
      sections: klass.sections.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

  // —— Fees: open dues + defaulters + today ——
  const paidMap = await paidAmountsForCharges(charges.map((c) => c._id));
  let openDuesAmount = 0;
  let openDuesCount = 0;
  const balanceByStudent = new Map();

  for (const charge of charges) {
    const paid = paidMap.get(String(charge._id)) || 0;
    const amount = Number(charge.amount) || 0;
    const balance = Math.max(0, amount - paid);
    if (balance <= 0) continue;
    openDuesAmount += balance;
    openDuesCount += 1;

    const student = charge.student;
    if (!student || student.isActive === false) continue;
    const sid = String(student._id);
    const prev = balanceByStudent.get(sid) || {
      student: {
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
      },
      balance: 0,
      dues: 0,
    };
    prev.balance += balance;
    prev.dues += 1;
    balanceByStudent.set(sid, prev);
  }

  const defaulters = [...balanceByStudent.values()]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8)
    .map((row) => ({
      ...row,
      balance: Math.round(row.balance),
    }));

  const todayCollectionAmount = todayPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );

  // —— Results: incomplete marks by exam × section ——
  const examIds = exams.map((e) => e._id);
  const assessments = examIds.length
    ? await SubjectAssessment.find({
        academy: academyId,
        examTerm: { $in: examIds },
      })
        .select("examTerm section subjectName")
        .lean()
    : [];

  const assessmentIds = assessments.map((a) => a._id);
  const markEntered = assessmentIds.length
    ? await StudentMark.aggregate([
        {
          $match: {
            academy: academyId,
            assessment: { $in: assessmentIds },
            $or: [
              { isAbsent: true },
              { obtainedMarks: { $ne: null } },
            ],
          },
        },
        { $group: { _id: "$assessment", entered: { $sum: 1 } } },
      ])
    : [];
  const enteredByAssessment = new Map(
    markEntered.map((row) => [String(row._id), row.entered])
  );

  const sectionMeta = new Map(
    sections.map((s) => [
      String(s._id),
      {
        name: s.name,
        className: s.class?.name || "—",
        classId: s.class?._id,
        studentCount: countBySection.get(String(s._id)) || 0,
      },
    ])
  );
  const examMeta = new Map(
    exams.map((e) => [String(e._id), { name: e.name, _id: e._id }])
  );

  // Group assessments by exam+section
  const groupKey = (examId, sectionId) => `${examId}:${sectionId}`;
  const groups = new Map();
  for (const assessment of assessments) {
    const key = groupKey(
      String(assessment.examTerm),
      String(assessment.section)
    );
    if (!groups.has(key)) {
      groups.set(key, {
        examId: String(assessment.examTerm),
        sectionId: String(assessment.section),
        subjects: 0,
        enteredMarks: 0,
        expectedMarks: 0,
      });
    }
    const g = groups.get(key);
    const meta = sectionMeta.get(String(assessment.section));
    const expected = meta?.studentCount || 0;
    const entered = enteredByAssessment.get(String(assessment._id)) || 0;
    g.subjects += 1;
    g.expectedMarks += expected;
    g.enteredMarks += Math.min(entered, expected || entered);
  }

  const incompleteResults = [];
  for (const g of groups.values()) {
    if (g.expectedMarks <= 0) continue;
    if (g.enteredMarks >= g.expectedMarks) continue;
    const exam = examMeta.get(g.examId);
    const section = sectionMeta.get(g.sectionId);
    if (!exam || !section) continue;
    const pct =
      g.expectedMarks > 0
        ? Math.round((g.enteredMarks / g.expectedMarks) * 1000) / 10
        : 0;
    incompleteResults.push({
      examId: g.examId,
      examName: exam.name,
      sectionId: g.sectionId,
      sectionName: section.name,
      className: section.className,
      subjects: g.subjects,
      enteredMarks: g.enteredMarks,
      expectedMarks: g.expectedMarks,
      missingMarks: Math.max(0, g.expectedMarks - g.enteredMarks),
      progressPercent: pct,
    });
  }
  incompleteResults.sort(
    (a, b) =>
      b.missingMarks - a.missingMarks ||
      a.examName.localeCompare(b.examName) ||
      a.className.localeCompare(b.className)
  );

  const classCount = await Class.countDocuments({
    academy: academyId,
    isActive: true,
  });

  res.json({
    success: true,
    session,
    generatedAt: new Date().toISOString(),
    kpis: {
      students: totalStudents,
      classes: classCount,
      sections: sections.filter((s) => s.class && s.class.isActive !== false)
        .length,
      openDuesCount,
      openDuesAmount: Math.round(openDuesAmount),
      todayCollectionAmount: Math.round(todayCollectionAmount),
      todayPaymentCount: todayPayments.length,
      incompleteResultSheets: incompleteResults.length,
      exams: exams.length,
    },
    classes,
    fees: {
      openDuesAmount: Math.round(openDuesAmount),
      openDuesCount,
      todayCollectionAmount: Math.round(todayCollectionAmount),
      todayPaymentCount: todayPayments.length,
      defaulters,
      todayPayments: todayPayments.slice(0, 8).map((p) => ({
        _id: p._id,
        amount: Math.round(Number(p.amount) || 0),
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
        method: p.method,
        student: p.student
          ? {
              _id: p.student._id,
              name: p.student.name,
              rollNumber: p.student.rollNumber,
            }
          : null,
      })),
    },
    results: {
      incomplete: incompleteResults.slice(0, 12),
      incompleteTotal: incompleteResults.length,
    },
  });
});
