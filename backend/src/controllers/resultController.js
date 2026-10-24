import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import StudentSubject from "../models/StudentSubject.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import StudentMark from "../models/StudentMark.js";
import AssessmentManualMark from "../models/AssessmentManualMark.js";
import Academy from "../models/Academy.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { currentAcademicSession, resolveSession } from "../utils/academicSession.js";
import {
  appendManualGazetteRows,
  appendManualMultiRoundGazetteRows,
  compareExamsByDate,
  compileMultiRoundSectionResult,
  compileSectionResult,
  formatResultMarks,
  formatResultPercent,
  gradeFromPercent,
  percentOf,
  sortByRoll,
} from "../utils/resultHelpers.js";
import { GROUP_LABELS } from "../constants/scienceCurriculum.js";

const DEFAULT_ASSESSMENT_TOTAL = 30;

function roundHasEnteredMarks(round) {
  return (round.assessments || []).some((assessment) =>
    (assessment.marks || []).some(
      (mark) => mark.isAbsent || mark.obtainedMarks != null
    )
  );
}

function mapManualMarks(manuals, subjectIdByAssessment, roundId) {
  return (manuals || [])
    .map((mark) => ({
      id: String(mark._id),
      roundId: roundId ? String(roundId) : undefined,
      subjectId: subjectIdByAssessment.get(String(mark.assessment)),
      rollNumber: mark.rollNumber,
      name: mark.name,
      fatherName: mark.fatherName,
      obtainedMarks: mark.obtainedMarks,
      isAbsent: mark.isAbsent,
    }))
    .filter((mark) => mark.subjectId);
}

/** Session filter for roster: one string, or several when compiling mixed rounds. */
function rosterSessionFilter(examsOrSession) {
  if (!examsOrSession) return undefined;
  if (typeof examsOrSession === "string") {
    return resolveSession(examsOrSession);
  }
  const sessions = [
    ...new Set(
      (Array.isArray(examsOrSession) ? examsOrSession : [])
        .map((e) => e?.session)
        .filter(Boolean)
        .map((s) => resolveSession(s))
    ),
  ];
  if (!sessions.length) return undefined;
  if (sessions.length === 1) return sessions[0];
  return sessions;
}

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

async function loadSectionOrThrow(academyId, sectionId) {
  const section = await Section.findOne({ _id: sectionId, academy: academyId })
    .populate("class", "name gradeLevel")
    .lean();
  if (!section) throw httpError(404, "Section not found");
  return section;
}

async function loadExamOrThrow(academyId, examId) {
  const exam = await ExamTerm.findOne({ _id: examId, academy: academyId }).lean();
  if (!exam) throw httpError(404, "Exam not found");
  return exam;
}

async function sectionStudents(academyId, sectionId, session) {
  const filter = {
    academy: academyId,
    section: sectionId,
    isActive: true,
  };
  if (session) {
    filter.session = Array.isArray(session) ? { $in: session } : session;
  }
  return Student.find(filter)
    .select("name fatherName rollNumber major group session")
    .sort({ rollNumber: 1 })
    .lean();
}

async function enrollmentMap(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await StudentSubject.find({
    student: { $in: studentIds },
  })
    .select("student subject")
    .lean();
  const map = new Map();
  for (const row of rows) {
    const key = String(row.student);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(String(row.subject));
  }
  return map;
}

/** Unique subjects enrolled by active students in the section (defaults for new exams). */
async function defaultSubjectIdsForSection(academyId, sectionId, session) {
  const students = await sectionStudents(academyId, sectionId, session);
  if (!students.length) return [];
  const enroll = await enrollmentMap(students.map((s) => s._id));
  const ids = new Set();
  for (const list of enroll.values()) {
    for (const id of list) ids.add(id);
  }
  return [...ids];
}

async function ensureSectionExamSubjects({
  academyId,
  sectionId,
  examTermId,
}) {
  const existing = await SubjectAssessment.countDocuments({
    academy: academyId,
    section: sectionId,
    examTerm: examTermId,
  });
  if (existing > 0) return { created: 0 };

  let subjectIds = await defaultSubjectIdsForSection(academyId, sectionId);

  // Fallback: copy from a sibling section that already has assessments for this exam
  if (subjectIds.length === 0) {
    const section = await Section.findById(sectionId).select("class").lean();
    if (section?.class) {
      const siblings = await Section.find({
        academy: academyId,
        class: section.class,
        _id: { $ne: sectionId },
      })
        .select("_id")
        .lean();
      if (siblings.length) {
        const siblingAssessments = await SubjectAssessment.find({
          academy: academyId,
          examTerm: examTermId,
          section: { $in: siblings.map((s) => s._id) },
        })
          .select("section subject subjectName")
          .lean();
        if (siblingAssessments.length) {
          const bySection = new Map();
          for (const row of siblingAssessments) {
            const key = String(row.section);
            if (!bySection.has(key)) bySection.set(key, []);
            bySection.get(key).push(row);
          }
          const best = [...bySection.values()].sort(
            (a, b) => b.length - a.length
          )[0];
          if (best?.length) {
            const subjects = await Subject.find({
              _id: { $in: best.map((r) => r.subject) },
            })
              .select("name")
              .lean();
            const nameById = new Map(
              subjects.map((s) => [String(s._id), s.name])
            );
            await SubjectAssessment.insertMany(
              best.map((row) => ({
                academy: academyId,
                examTerm: examTermId,
                section: sectionId,
                subject: row.subject,
                subjectName:
                  nameById.get(String(row.subject)) || row.subjectName,
                totalMarks: DEFAULT_ASSESSMENT_TOTAL,
              })),
              { ordered: false }
            ).catch(() => undefined);
            return { created: best.length };
          }
        }
      }
    }
  }

  if (subjectIds.length === 0) return { created: 0 };

  const subjects = await Subject.find({ _id: { $in: subjectIds } })
    .select("name")
    .lean();
  await SubjectAssessment.insertMany(
    subjects.map((subject) => ({
      academy: academyId,
      examTerm: examTermId,
      section: sectionId,
      subject: subject._id,
      subjectName: subject.name,
      totalMarks: DEFAULT_ASSESSMENT_TOTAL,
    })),
    { ordered: false }
  ).catch(() => undefined);

  return { created: subjects.length };
}

function markEntered(mark) {
  return Boolean(mark && (mark.isAbsent || mark.obtainedMarks != null));
}

/** GET /api/results/hub */
export const getResultsHub = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const sections = await Section.find({ academy: academyId, isActive: true })
    .populate("class", "name gradeLevel isActive")
    .sort({ name: 1 })
    .lean();

  const sectionIds = sections.map((s) => s._id);
  const studentCounts = await Student.aggregate([
    {
      $match: {
        academy: academyId,
        section: { $in: sectionIds },
        isActive: true,
      },
    },
    { $group: { _id: "$section", count: { $sum: 1 } } },
  ]);
  const countBySection = new Map(
    studentCounts.map((row) => [String(row._id), row.count])
  );

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
        sections: [],
        sectionCount: 0,
        studentCount: 0,
      });
    }
    const bucket = byClass.get(classId);
    const studentCount = countBySection.get(String(section._id)) || 0;
    bucket.sections.push({
      _id: section._id,
      name: section.name,
      studentCount,
    });
    bucket.sectionCount += 1;
    bucket.studentCount += studentCount;
  }

  const classes = [...byClass.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  // Academy-wide exams with which sections already have subject rows
  const exams = await ExamTerm.find({ academy: academyId })
    .sort({ session: -1, createdAt: -1, name: 1 })
    .lean();
  const examIds = exams.map((e) => e._id);
  const examSectionRows = examIds.length
    ? await SubjectAssessment.aggregate([
        {
          $match: {
            academy: academyId,
            examTerm: { $in: examIds },
          },
        },
        {
          $group: {
            _id: { examTerm: "$examTerm", section: "$section" },
          },
        },
      ])
    : [];
  const sectionsByExam = new Map();
  for (const row of examSectionRows) {
    const examKey = String(row._id.examTerm);
    if (!sectionsByExam.has(examKey)) sectionsByExam.set(examKey, []);
    sectionsByExam.get(examKey).push(String(row._id.section));
  }

  const sectionLookup = new Map();
  for (const klass of classes) {
    for (const section of klass.sections) {
      sectionLookup.set(String(section._id), {
        _id: section._id,
        name: section.name,
        className: klass.name,
        classId: klass._id,
      });
    }
  }

  const examSummaries = exams
    .map((exam) => {
      const sectionIdsForExam = sectionsByExam.get(String(exam._id)) || [];
      const attachedSections = sectionIdsForExam
        .map((id) => sectionLookup.get(id))
        .filter(Boolean)
        .sort((a, b) =>
          `${a.className} ${a.name}`.localeCompare(
            `${b.className} ${b.name}`,
            undefined,
            { numeric: true }
          )
        );
      return {
        ...exam,
        sectionCount: attachedSections.length,
        sections: attachedSections,
      };
    })
    .sort(compareExamsByDate);

  res.json({
    success: true,
    classes,
    exams: examSummaries,
    session: currentAcademicSession(),
  });
});

/** GET /api/results/exams */
export const listExams = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = req.query.session
    ? resolveSession(req.query.session)
    : undefined;
  const filter = { academy: academyId };
  if (session) filter.session = session;

  const exams = await ExamTerm.find(filter)
    .sort({ session: -1, createdAt: -1, name: 1 })
    .lean();

  res.json({ success: true, exams });
});

/** POST /api/results/exams — upsert by name+session; seed one or many sections */
export const createExam = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = String(req.body.name || "").trim();
  if (name.length < 2) throw httpError(400, "Exam name is required");

  const session = resolveSession(req.body.session || currentAcademicSession());
  const passPercent = Math.min(
    100,
    Math.max(1, Number(req.body.passPercent) || 33)
  );
  const examDate = req.body.examDate
    ? new Date(`${req.body.examDate}T00:00:00`)
    : null;

  const rawIds = Array.isArray(req.body.sectionIds)
    ? req.body.sectionIds
    : req.body.sectionId
      ? [req.body.sectionId]
      : [];
  const sectionIds = [
    ...new Set(
      rawIds.map((id) => String(id || "").trim()).filter(Boolean)
    ),
  ];
  if (!sectionIds.length) {
    throw httpError(400, "Select at least one section");
  }

  for (const sectionId of sectionIds) {
    await loadSectionOrThrow(academyId, sectionId);
  }

  let exam = await ExamTerm.findOne({ academy: academyId, name, session });
  const existed = Boolean(exam);
  if (exam) {
    exam.passPercent = passPercent;
    exam.examDate = examDate;
    await exam.save();
  } else {
    exam = await ExamTerm.create({
      academy: academyId,
      name,
      session,
      passPercent,
      examDate,
    });
  }

  for (const sectionId of sectionIds) {
    await ensureSectionExamSubjects({
      academyId,
      sectionId,
      examTermId: exam._id,
    });
  }

  res.status(existed ? 200 : 201).json({
    success: true,
    exam,
    existed,
    updated: existed,
    sectionIds,
    sectionsSeeded: sectionIds.length,
    message: existed
      ? `Updated existing exam "${name}" (${session}) for ${sectionIds.length} section${sectionIds.length === 1 ? "" : "s"}`
      : sectionIds.length > 0
        ? `Exam ready for ${sectionIds.length} section${sectionIds.length === 1 ? "" : "s"}`
        : "Exam created",
  });
});

/** DELETE /api/results/exams/:id — delete whole exam (all sections) */
export const deleteExam = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const exam = await ExamTerm.findOne({
    _id: req.params.id,
    academy: academyId,
  });
  if (!exam) throw httpError(404, "Exam not found");

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    examTerm: exam._id,
  })
    .select("_id")
    .lean();
  const assessmentIds = assessments.map((a) => a._id);

  if (assessmentIds.length) {
    await Promise.all([
      StudentMark.deleteMany({ assessment: { $in: assessmentIds } }),
      AssessmentManualMark.deleteMany({ assessment: { $in: assessmentIds } }),
      SubjectAssessment.deleteMany({ _id: { $in: assessmentIds } }),
    ]);
  }

  await exam.deleteOne();
  res.json({ success: true, message: "Exam deleted" });
});

/** DELETE /api/results/sections/:sectionId/exams/:examId — clear section result only */
export const deleteSectionExamResult = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { sectionId, examId } = req.params;
  await loadSectionOrThrow(academyId, sectionId);
  await loadExamOrThrow(academyId, examId);

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .select("_id")
    .lean();
  const assessmentIds = assessments.map((a) => a._id);

  if (assessmentIds.length) {
    await Promise.all([
      StudentMark.deleteMany({ assessment: { $in: assessmentIds } }),
      AssessmentManualMark.deleteMany({ assessment: { $in: assessmentIds } }),
      SubjectAssessment.deleteMany({ _id: { $in: assessmentIds } }),
    ]);
  }

  res.json({ success: true, message: "Section exam result cleared" });
});

/** GET /api/results/sections/:sectionId */
export const getSectionExams = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const section = await loadSectionOrThrow(academyId, req.params.sectionId);

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: section._id,
  })
    .select("examTerm")
    .lean();
  const examIds = [...new Set(assessments.map((a) => String(a.examTerm)))];

  const exams = examIds.length
    ? await ExamTerm.find({ _id: { $in: examIds }, academy: academyId })
        .sort({ session: -1, createdAt: -1, name: 1 })
        .lean()
    : [];

  const progress = await Promise.all(
    exams.map(async (exam) => {
      const sectionAssessments = await SubjectAssessment.find({
        academy: academyId,
        section: section._id,
        examTerm: exam._id,
      })
        .select("_id")
        .lean();
      const ids = sectionAssessments.map((a) => a._id);
      let subjectsWithMarks = 0;
      if (ids.length) {
        const [markCounts, manualCounts] = await Promise.all([
          StudentMark.aggregate([
            {
              $match: {
                assessment: { $in: ids },
                $or: [{ isAbsent: true }, { obtainedMarks: { $ne: null } }],
              },
            },
            { $group: { _id: "$assessment", count: { $sum: 1 } } },
          ]),
          AssessmentManualMark.aggregate([
            {
              $match: {
                assessment: { $in: ids },
                $or: [{ isAbsent: true }, { obtainedMarks: { $ne: null } }],
              },
            },
            { $group: { _id: "$assessment", count: { $sum: 1 } } },
          ]),
        ]);
        const withMarks = new Set([
          ...markCounts.map((r) => String(r._id)),
          ...manualCounts.map((r) => String(r._id)),
        ]);
        subjectsWithMarks = withMarks.size;
      }
      return {
        ...exam,
        subjectCount: ids.length,
        subjectsWithMarks,
      };
    })
  );

  const studentCount = await Student.countDocuments({
    academy: academyId,
    section: section._id,
    isActive: true,
  });

  res.json({
    success: true,
    section: {
      _id: section._id,
      name: section.name,
      class: section.class,
      studentCount,
    },
    exams: progress,
    session: currentAcademicSession(),
  });
});

/** GET /api/results/sections/:sectionId/exams/:examId */
export const getExamSubjects = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { sectionId, examId } = req.params;
  const section = await loadSectionOrThrow(academyId, sectionId);
  const exam = await loadExamOrThrow(academyId, examId);

  await ensureSectionExamSubjects({
    academyId,
    sectionId,
    examTermId: exam._id,
  });

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .populate("subject", "name")
    .sort({ subjectName: 1 })
    .lean();

  const students = await sectionStudents(
    academyId,
    sectionId,
    rosterSessionFilter(exam.session)
  );
  const enroll = await enrollmentMap(students.map((s) => s._id));

  const assessmentIds = assessments.map((a) => a._id);
  const [allMarks, allManual] = await Promise.all([
    StudentMark.find({ assessment: { $in: assessmentIds } })
      .select("assessment student obtainedMarks isAbsent")
      .lean(),
    AssessmentManualMark.find({ assessment: { $in: assessmentIds } })
      .select("assessment obtainedMarks isAbsent")
      .lean(),
  ]);

  const marksByAssessment = new Map();
  for (const mark of allMarks) {
    const key = String(mark.assessment);
    if (!marksByAssessment.has(key)) marksByAssessment.set(key, []);
    marksByAssessment.get(key).push(mark);
  }
  const manualByAssessment = new Map();
  for (const mark of allManual) {
    const key = String(mark.assessment);
    if (!manualByAssessment.has(key)) manualByAssessment.set(key, []);
    manualByAssessment.get(key).push(mark);
  }

  const subjects = assessments.map((assessment) => {
    const subjectId = String(assessment.subject?._id || assessment.subject);
    const enrolledIds = new Set(
      students
        .filter((student) => {
          const list = enroll.get(String(student._id)) || [];
          if (list.length === 0) return true;
          return list.includes(subjectId);
        })
        .map((s) => String(s._id))
    );
    const marks = marksByAssessment.get(String(assessment._id)) || [];
    const manuals = manualByAssessment.get(String(assessment._id)) || [];
    const entered =
      marks.filter((m) => enrolledIds.has(String(m.student)) && markEntered(m))
        .length + manuals.filter((m) => markEntered(m)).length;

    return {
      _id: assessment._id,
      subject: {
        _id: assessment.subject?._id || assessment.subject,
        name: assessment.subject?.name || assessment.subjectName,
      },
      subjectName: assessment.subjectName,
      totalMarks: assessment.totalMarks,
      enrolledCount: enrolledIds.size || students.length,
      entered,
      ready: entered > 0,
    };
  });

  // Available subjects to add: all Subject masters used by academy students + all active subjects
  const selectedIds = new Set(
    subjects.map((s) => String(s.subject._id))
  );
  const enrolledSubjectIds = [
    ...new Set([...enroll.values()].flat()),
  ];
  let availableQuery = Subject.find({ isActive: true }).select("name").sort({
    name: 1,
  });
  const allSubjects = await availableQuery.lean();
  const enrolledSet = new Set(enrolledSubjectIds);
  const availableSubjects = allSubjects
    .filter((s) => !selectedIds.has(String(s._id)))
    .map((s) => ({
      _id: s._id,
      name: s.name,
      suggested: enrolledSet.has(String(s._id)),
    }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.name.localeCompare(b.name));

  res.json({
    success: true,
    section: {
      _id: section._id,
      name: section.name,
      class: section.class,
      studentCount: students.length,
    },
    exam,
    subjects,
    availableSubjects,
  });
});

/** POST /api/results/sections/:sectionId/exams/:examId/subjects */
export const addExamSubjects = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { sectionId, examId } = req.params;
  await loadSectionOrThrow(academyId, sectionId);
  await loadExamOrThrow(academyId, examId);

  const subjectIds = [
    ...new Set(
      (Array.isArray(req.body.subjectIds) ? req.body.subjectIds : [])
        .map(String)
        .filter(Boolean)
    ),
  ];
  if (!subjectIds.length) throw httpError(400, "Select at least one subject");

  const subjects = await Subject.find({
    _id: { $in: subjectIds },
    isActive: true,
  })
    .select("name")
    .lean();
  if (!subjects.length) throw httpError(400, "No valid subjects found");

  const totalMarks = Number(req.body.totalMarks) || DEFAULT_ASSESSMENT_TOTAL;
  let created = 0;
  for (const subject of subjects) {
    try {
      await SubjectAssessment.create({
        academy: academyId,
        examTerm: examId,
        section: sectionId,
        subject: subject._id,
        subjectName: subject.name,
        totalMarks,
      });
      created += 1;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  res.status(201).json({ success: true, created });
});

/** DELETE /api/results/assessments/:id */
export const deleteAssessment = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const assessment = await SubjectAssessment.findOne({
    _id: req.params.id,
    academy: academyId,
  });
  if (!assessment) throw httpError(404, "Assessment not found");

  await Promise.all([
    StudentMark.deleteMany({ assessment: assessment._id }),
    AssessmentManualMark.deleteMany({ assessment: assessment._id }),
    assessment.deleteOne(),
  ]);

  res.json({ success: true, message: "Subject assessment deleted" });
});

/** GET /api/results/assessments/:id/marks */
export const getAssessmentMarks = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const assessment = await SubjectAssessment.findOne({
    _id: req.params.id,
    academy: academyId,
  })
    .populate("subject", "name")
    .populate("examTerm", "name session passPercent")
    .lean();
  if (!assessment) throw httpError(404, "Assessment not found");

  const section = await loadSectionOrThrow(academyId, assessment.section);
  const students = await sectionStudents(
    academyId,
    assessment.section,
    rosterSessionFilter(assessment.examTerm?.session)
  );
  const subjectId = String(assessment.subject?._id || assessment.subject);
  const enroll = await enrollmentMap(students.map((s) => s._id));

  const rosterStudents = students.filter((student) => {
    const list = enroll.get(String(student._id)) || [];
    if (list.length === 0) return true;
    return list.includes(subjectId);
  });

  const [marks, manualMarks] = await Promise.all([
    StudentMark.find({ assessment: assessment._id }).lean(),
    AssessmentManualMark.find({ assessment: assessment._id })
      .sort({ rollNumber: 1 })
      .lean(),
  ]);

  const markByStudent = new Map(
    marks.map((m) => [String(m.student), m])
  );

  const roster = rosterStudents
    .slice()
    .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber))
    .map((student) => {
      const mark = markByStudent.get(String(student._id));
      return {
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        fatherName: student.fatherName,
        obtainedMarks: mark?.obtainedMarks ?? null,
        isAbsent: mark?.isAbsent ?? false,
      };
    });

  res.json({
    success: true,
    assessment: {
      _id: assessment._id,
      subjectName: assessment.subject?.name || assessment.subjectName,
      totalMarks: assessment.totalMarks,
      section: {
        _id: section._id,
        name: section.name,
        class: section.class,
      },
      exam: assessment.examTerm,
    },
    roster,
    manualMarks: manualMarks.map((row) => ({
      _id: row._id,
      rollNumber: row.rollNumber,
      name: row.name,
      fatherName: row.fatherName,
      obtainedMarks: row.obtainedMarks,
      isAbsent: row.isAbsent,
    })),
  });
});

/** PUT /api/results/assessments/:id/marks */
export const saveAssessmentMarks = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const assessment = await SubjectAssessment.findOne({
    _id: req.params.id,
    academy: academyId,
  }).populate("examTerm", "session");
  if (!assessment) throw httpError(404, "Assessment not found");

  const totalMarksInput =
    req.body.totalMarks != null && req.body.totalMarks !== ""
      ? Number(req.body.totalMarks)
      : null;
  if (
    totalMarksInput != null &&
    (!Number.isFinite(totalMarksInput) ||
      totalMarksInput <= 0 ||
      totalMarksInput > 1000)
  ) {
    throw httpError(400, "Total marks must be between 0.01 and 1000");
  }

  const max =
    totalMarksInput != null ? totalMarksInput : Number(assessment.totalMarks);

  const studentMarks = Array.isArray(req.body.studentMarks)
    ? req.body.studentMarks
    : [];
  const manualMarks = Array.isArray(req.body.manualMarks)
    ? req.body.manualMarks
    : [];

  const students = await sectionStudents(
    academyId,
    assessment.section,
    rosterSessionFilter(assessment.examTerm?.session)
  );
  const allowed = new Set(students.map((s) => String(s._id)));
  const enrolledRolls = new Set(
    students.map((s) => s.rollNumber.trim().toLowerCase())
  );

  const manualRolls = new Set();
  for (const row of manualMarks) {
    const rollKey = String(row.rollNumber || "")
      .trim()
      .toLowerCase();
    if (!rollKey) throw httpError(400, "Extra row needs a roll number");
    if (manualRolls.has(rollKey)) {
      throw httpError(400, `Duplicate roll number ${row.rollNumber} in extra rows`);
    }
    manualRolls.add(rollKey);
    if (enrolledRolls.has(rollKey)) {
      throw httpError(
        400,
        `Roll ${row.rollNumber} is already on the section list — use that row instead.`
      );
    }
  }

  const parseObtained = (row) => {
    if (row.absent || row.isAbsent) return { obtainedMarks: null, isAbsent: true };
    const raw =
      row.obtained != null
        ? String(row.obtained).trim()
        : row.obtainedMarks != null
          ? String(row.obtainedMarks).trim()
          : "";
    if (!raw) return { obtainedMarks: null, isAbsent: false };
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > max) {
      throw httpError(400, `Marks must be between 0 and ${max}`);
    }
    return { obtainedMarks: value, isAbsent: false };
  };

  if (totalMarksInput != null && totalMarksInput !== Number(assessment.totalMarks)) {
    assessment.totalMarks = totalMarksInput;
    await assessment.save();
  }

  for (const row of studentMarks) {
    const studentId = String(row.studentId || "");
    if (!allowed.has(studentId)) continue;
    const { obtainedMarks, isAbsent } = parseObtained(row);
    await StudentMark.findOneAndUpdate(
      { assessment: assessment._id, student: studentId },
      {
        academy: academyId,
        assessment: assessment._id,
        student: studentId,
        obtainedMarks,
        isAbsent,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const keepManualIds = [];
  for (const row of manualMarks) {
    const { obtainedMarks, isAbsent } = parseObtained(row);
    const data = {
      academy: academyId,
      assessment: assessment._id,
      rollNumber: String(row.rollNumber).trim(),
      name: String(row.name || "").trim(),
      fatherName: String(row.fatherName || "").trim(),
      obtainedMarks,
      isAbsent,
    };
    if (!data.name) throw httpError(400, "Extra row needs a student name");

    if (row._id || row.id) {
      const id = row._id || row.id;
      const existing = await AssessmentManualMark.findOne({
        _id: id,
        assessment: assessment._id,
      });
      if (!existing) throw httpError(400, `Extra row not found for roll ${row.rollNumber}`);
      Object.assign(existing, data);
      await existing.save();
      keepManualIds.push(existing._id);
    } else {
      const created = await AssessmentManualMark.create(data);
      keepManualIds.push(created._id);
    }
  }

  await AssessmentManualMark.deleteMany(
    keepManualIds.length === 0
      ? { assessment: assessment._id }
      : { assessment: assessment._id, _id: { $nin: keepManualIds } }
  );

  res.json({ success: true, message: "Marks saved" });
});

async function buildRoundAssessments(academyId, sectionId, examId) {
  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .populate("subject", "name")
    .sort({ subjectName: 1 })
    .lean();

  if (!assessments.length) {
    return {
      assessments: [],
      manuals: [],
      subjectIdByAssessment: new Map(),
    };
  }

  const assessmentIds = assessments.map((a) => a._id);
  const [marks, manuals] = await Promise.all([
    StudentMark.find({ assessment: { $in: assessmentIds } }).lean(),
    AssessmentManualMark.find({ assessment: { $in: assessmentIds } }).lean(),
  ]);

  const marksByAssessment = new Map();
  for (const mark of marks) {
    const key = String(mark.assessment);
    if (!marksByAssessment.has(key)) marksByAssessment.set(key, []);
    marksByAssessment.get(key).push(mark);
  }

  return {
    assessments: assessments.map((a) => {
      const subjectId = String(a.subject?._id || a.subject);
      const rows = marksByAssessment.get(String(a._id)) || [];
      return {
        subjectId,
        subjectName: a.subject?.name || a.subjectName,
        totalMarks: Number(a.totalMarks),
        marks: rows.map((mark) => ({
          studentId: String(mark.student),
          obtainedMarks: mark.obtainedMarks,
          isAbsent: mark.isAbsent,
        })),
      };
    }),
    manuals,
    subjectIdByAssessment: new Map(
      assessments.map((a) => [
        String(a._id),
        String(a.subject?._id || a.subject),
      ])
    ),
  };
}

/**
 * POST /api/results/compile
 * Body: { sectionIds: string[], examIds: string[] }
 * Compiles one gazette sheet per section, combining selected exam rounds.
 */
export const compileResults = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const sectionIds = [
    ...new Set(
      (Array.isArray(req.body.sectionIds) ? req.body.sectionIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
  const examIds = [
    ...new Set(
      (Array.isArray(req.body.examIds) ? req.body.examIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];

  if (!sectionIds.length) {
    throw httpError(400, "Select at least one section");
  }
  if (!examIds.length) {
    throw httpError(400, "Select at least one exam / round");
  }

  const exams = (
    await ExamTerm.find({
      _id: { $in: examIds },
      academy: academyId,
    }).lean()
  ).sort(compareExamsByDate);
  if (exams.length !== examIds.length) {
    throw httpError(404, "One or more exams were not found");
  }

  const passPercent = Math.min(...exams.map((e) => Number(e.passPercent) || 33));
  const academy = await Academy.findById(academyId)
    .select("name logo address phone email")
    .lean();

  const combineSections =
    Boolean(req.body.combineSections) && sectionIds.length > 1;
  const rosterSession = rosterSessionFilter(exams);
  const skippedSections = [];

  // Optional: one merged sheet for all selected sections
  if (combineSections) {
    const sectionMetas = [];
    for (const sectionId of sectionIds) {
      sectionMetas.push(await loadSectionOrThrow(academyId, sectionId));
    }

    const classNames = [
      ...new Set(sectionMetas.map((s) => s.class?.name).filter(Boolean)),
    ];
    const sectionNames = sectionMetas.map((s) => s.name);
    const gradeLevel =
      sectionMetas.find((s) => s.class?.gradeLevel != null)?.class
        ?.gradeLevel ?? null;
    const classLabel =
      classNames.length === 1
        ? classNames[0]
        : classNames.join(" / ") || "Class";
    const sectionLabel = sectionNames.join(" + ");

    const compiledStudents = [];
    const sectionByStudentId = new Map();

    for (const section of sectionMetas) {
      const students = await sectionStudents(
        academyId,
        section._id,
        rosterSession
      );
      const enroll = await enrollmentMap(students.map((s) => s._id));
      for (const student of students) {
        const id = String(student._id);
        sectionByStudentId.set(id, section.name);
        compiledStudents.push({
          id,
          rollNumber: student.rollNumber,
          name: student.name,
          fatherName: student.fatherName,
          major: student.major,
          group: student.group,
          sectionName: section.name,
          enrolledSubjectIds: enroll.get(id) || [],
        });
      }
    }

    compiledStudents.sort(
      (a, b) =>
        sortByRoll(a.rollNumber, b.rollNumber) ||
        String(a.sectionName).localeCompare(String(b.sectionName))
    );

    const rounds = [];
    let singleRoundManuals = [];
    const multiRoundManuals = [];

    for (const exam of exams) {
      const bySubject = new Map();
      const manuals = [];
      const subjectMap = new Map();

      for (const section of sectionMetas) {
        const packed = await buildRoundAssessments(
          academyId,
          section._id,
          exam._id
        );
        if (packed.manuals?.length) manuals.push(...packed.manuals);
        for (const [assessmentId, subjectId] of packed.subjectIdByAssessment) {
          subjectMap.set(assessmentId, subjectId);
        }
        for (const assessment of packed.assessments || []) {
          const key = String(assessment.subjectId);
          const existing = bySubject.get(key);
          if (!existing) {
            bySubject.set(key, {
              subjectId: key,
              subjectName: assessment.subjectName,
              totalMarks: Number(assessment.totalMarks) || 0,
              marks: [...(assessment.marks || [])],
            });
          } else {
            existing.marks.push(...(assessment.marks || []));
            existing.totalMarks = Math.max(
              existing.totalMarks,
              Number(assessment.totalMarks) || 0
            );
          }
        }
      }

      if (!bySubject.size) continue;

      const round = {
        id: String(exam._id),
        label: exam.name,
        assessments: [...bySubject.values()],
      };
      rounds.push(round);
      multiRoundManuals.push(
        ...mapManualMarks(manuals, subjectMap, exam._id)
      );
      if (rounds.length === 1) {
        singleRoundManuals = mapManualMarks(manuals, subjectMap);
      }
    }

    let columns = [];
    let rows = [];
    let empty = false;
    let message;

    if (!compiledStudents.length) {
      empty = true;
      message = "No students in the selected sections";
    } else if (!rounds.length || !rounds.some(roundHasEnteredMarks)) {
      empty = true;
      message = "No marks for the selected exams in these sections";
    } else if (rounds.length === 1) {
      const only = rounds[0];
      const subjects = only.assessments.map((a) => ({
        id: a.subjectId,
        name: a.subjectName,
        totalMarks: a.totalMarks,
      }));
      const markRows = only.assessments.flatMap((a) =>
        a.marks.map((mark) => ({
          studentId: mark.studentId,
          subjectId: a.subjectId,
          obtainedMarks: mark.obtainedMarks,
          isAbsent: mark.isAbsent,
        }))
      );
      const compiled = compileSectionResult({
        passPercent,
        className: classLabel,
        gradeLevel,
        students: compiledStudents,
        subjects,
        marks: markRows,
      });
      columns = compiled.columns;
      rows = compiled.rows;

      if (singleRoundManuals.length) {
        rows = appendManualGazetteRows({
          columns,
          rows,
          subjects,
          passPercent,
          manualMarks: singleRoundManuals,
        });
      }
    } else {
      const compiled = compileMultiRoundSectionResult({
        passPercent,
        className: classLabel,
        gradeLevel,
        students: compiledStudents,
        rounds,
      });
      columns = compiled.columns;
      rows = compiled.rows;
      if (multiRoundManuals.length) {
        rows = appendManualMultiRoundGazetteRows({
          columns,
          rows,
          rounds,
          passPercent,
          manualMarks: multiRoundManuals,
        });
      }
    }

    rows = rows.map((row) => ({
      ...row,
      sectionName:
        sectionByStudentId.get(String(row.id)) || row.sectionName || "",
    }));

    return res.json({
      success: true,
      academy,
      session: exams[0]?.session || currentAcademicSession(),
      passPercent,
      exams: exams.map((e) => ({
        _id: e._id,
        name: e.name,
        session: e.session,
        passPercent: e.passPercent,
      })),
      sheets: [
        {
          section: {
            _id: sectionMetas[0]?._id,
            name: sectionLabel,
            class: {
              ...(sectionMetas[0]?.class || {}),
              name: classLabel,
            },
          },
          sections: sectionMetas.map((s) => ({
            _id: s._id,
            name: s.name,
            className: s.class?.name,
          })),
          exams: rounds.map((round) => ({
            _id: round.id,
            name: round.label,
          })),
          examLabel: rounds.map((round) => round.label).join(" + "),
          combined: rounds.length > 1 || sectionMetas.length > 1,
          multiRound: rounds.length > 1,
          multiSection: true,
          columns,
          rows,
          empty,
          message,
        },
      ],
      skippedSections,
      groupLabels: GROUP_LABELS,
    });
  }

  // Default: one printable sheet per section (page-break between sheets)
  const sheets = [];

  for (const sectionId of sectionIds) {
    const section = await loadSectionOrThrow(academyId, sectionId);
    const students = await sectionStudents(
      academyId,
      sectionId,
      rosterSession
    );
    const enroll = await enrollmentMap(students.map((s) => s._id));

    const compiledStudents = students.map((student) => ({
      id: String(student._id),
      rollNumber: student.rollNumber,
      name: student.name,
      fatherName: student.fatherName,
      major: student.major,
      group: student.group,
      enrolledSubjectIds: enroll.get(String(student._id)) || [],
    }));

    const rounds = [];
    let singleRoundManuals = [];
    const multiRoundManuals = [];

    for (const exam of exams) {
      const packed = await buildRoundAssessments(
        academyId,
        sectionId,
        exam._id
      );
      if (!packed.assessments?.length) continue;
      rounds.push({
        id: String(exam._id),
        label: exam.name,
        assessments: packed.assessments,
      });
      multiRoundManuals.push(
        ...mapManualMarks(
          packed.manuals,
          packed.subjectIdByAssessment,
          exam._id
        )
      );
      if (rounds.length === 1) {
        singleRoundManuals = mapManualMarks(
          packed.manuals,
          packed.subjectIdByAssessment
        );
      }
    }

    if (!rounds.length || !rounds.some(roundHasEnteredMarks)) {
      skippedSections.push({
        _id: section._id,
        name: section.name,
        className: section.class?.name || "",
        reason: "No entered marks for selected exam(s)",
      });
      // Single-section request still returns an empty sheet for clarity
      if (sectionIds.length === 1) {
        sheets.push({
          section: {
            _id: section._id,
            name: section.name,
            class: section.class,
          },
          exams: [],
          columns: [],
          rows: [],
          empty: true,
          multiRound: false,
          multiSection: false,
          message: "No marks for the selected exams in this section",
        });
      }
      continue;
    }

    let columns;
    let rows;

    if (rounds.length === 1) {
      const only = rounds[0];
      const subjects = only.assessments.map((a) => ({
        id: a.subjectId,
        name: a.subjectName,
        totalMarks: a.totalMarks,
      }));
      const markRows = only.assessments.flatMap((a) =>
        a.marks.map((mark) => ({
          studentId: mark.studentId,
          subjectId: a.subjectId,
          obtainedMarks: mark.obtainedMarks,
          isAbsent: mark.isAbsent,
        }))
      );
      const compiled = compileSectionResult({
        passPercent,
        className: section.class?.name,
        gradeLevel: section.class?.gradeLevel,
        students: compiledStudents,
        subjects,
        marks: markRows,
      });
      columns = compiled.columns;
      rows = compiled.rows;

      if (singleRoundManuals.length) {
        rows = appendManualGazetteRows({
          columns,
          rows,
          subjects,
          passPercent,
          manualMarks: singleRoundManuals,
        });
      }
    } else {
      const compiled = compileMultiRoundSectionResult({
        passPercent,
        className: section.class?.name,
        gradeLevel: section.class?.gradeLevel,
        students: compiledStudents,
        rounds,
      });
      columns = compiled.columns;
      rows = compiled.rows;
      if (multiRoundManuals.length) {
        rows = appendManualMultiRoundGazetteRows({
          columns,
          rows,
          rounds,
          passPercent,
          manualMarks: multiRoundManuals,
        });
      }
    }

    sheets.push({
      section: {
        _id: section._id,
        name: section.name,
        class: section.class,
      },
      exams: rounds.map((round) => ({
        _id: round.id,
        name: round.label,
      })),
      examLabel: rounds.map((round) => round.label).join(" + "),
      combined: rounds.length > 1,
      multiRound: rounds.length > 1,
      multiSection: false,
      columns,
      rows,
      empty: false,
    });
  }

  if (!sheets.length) {
    throw httpError(
      400,
      "No marked results found for the selected sections and exams"
    );
  }

  res.json({
    success: true,
    academy,
    session: exams[0]?.session || currentAcademicSession(),
    passPercent,
    exams: exams.map((e) => ({
      _id: e._id,
      name: e.name,
      session: e.session,
      passPercent: e.passPercent,
    })),
    sheets,
    skippedSections,
    groupLabels: GROUP_LABELS,
  });
});

/** GET /api/results/sections/:sectionId/exams/:examId/gazette */
export const getGazette = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { sectionId, examId } = req.params;
  const section = await loadSectionOrThrow(academyId, sectionId);
  const exam = await loadExamOrThrow(academyId, examId);

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    section: sectionId,
    examTerm: examId,
  })
    .populate("subject", "name")
    .sort({ subjectName: 1 })
    .lean();

  if (!assessments.length) {
    throw httpError(400, "Add subjects and enter marks before generating a result");
  }

  const students = await sectionStudents(
    academyId,
    sectionId,
    rosterSessionFilter(exam.session)
  );
  const enroll = await enrollmentMap(students.map((s) => s._id));

  const subjects = assessments.map((a) => ({
    id: String(a.subject?._id || a.subject),
    name: a.subject?.name || a.subjectName,
    totalMarks: Number(a.totalMarks),
  }));

  const assessmentIds = assessments.map((a) => a._id);
  const [marks, manuals] = await Promise.all([
    StudentMark.find({ assessment: { $in: assessmentIds } }).lean(),
    AssessmentManualMark.find({ assessment: { $in: assessmentIds } }).lean(),
  ]);

  const subjectIdByAssessment = new Map(
    assessments.map((a) => [
      String(a._id),
      String(a.subject?._id || a.subject),
    ])
  );

  const markRows = marks.map((mark) => ({
    studentId: String(mark.student),
    subjectId: subjectIdByAssessment.get(String(mark.assessment)),
    obtainedMarks: mark.obtainedMarks,
    isAbsent: mark.isAbsent,
  }));

  const compiledStudents = students.map((student) => ({
    id: String(student._id),
    rollNumber: student.rollNumber,
    name: student.name,
    fatherName: student.fatherName,
    major: student.major,
    group: student.group,
    enrolledSubjectIds: enroll.get(String(student._id)) || [],
  }));

  const { columns, rows } = compileSectionResult({
    passPercent: exam.passPercent,
    className: section.class?.name,
    gradeLevel: section.class?.gradeLevel,
    students: compiledStudents,
    subjects,
    marks: markRows,
  });

  const manualMarks = manuals.map((mark) => ({
    id: String(mark._id),
    subjectId: subjectIdByAssessment.get(String(mark.assessment)),
    rollNumber: mark.rollNumber,
    name: mark.name,
    fatherName: mark.fatherName,
    obtainedMarks: mark.obtainedMarks,
    isAbsent: mark.isAbsent,
  }));

  const allRows = appendManualGazetteRows({
    columns,
    rows,
    subjects,
    passPercent: Number(exam.passPercent) || 33,
    manualMarks,
  });

  const academy = await Academy.findById(academyId)
    .select("name logo address phone email")
    .lean();

  res.json({
    success: true,
    academy,
    section: {
      _id: section._id,
      name: section.name,
      class: section.class,
    },
    exam,
    columns,
    rows: allRows,
    groupLabels: GROUP_LABELS,
  });
});

/**
 * GET /api/results/students/:studentId/report
 * Query: exams=id1,id2 (optional — omit for every exam with marks)
 * Returns a printable student report card for the selected rounds.
 */
export const getStudentResultReport = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { studentId } = req.params;

  const student = await Student.findOne({
    _id: studentId,
    academy: academyId,
  })
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .lean();
  if (!student) throw httpError(404, "Student not found");
  if (!student.section) throw httpError(400, "Student has no section assigned");

  const sectionId = student.section._id || student.section;
  const requestedExamIds = [
    ...new Set(
      String(req.query.exams || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  // Marks follow the student across section transfers
  const allStudentMarks = await StudentMark.find({
    student: studentId,
    academy: academyId,
  }).lean();
  const markedAssessmentIds = [
    ...new Set(allStudentMarks.map((m) => String(m.assessment))),
  ];

  const assessments = await SubjectAssessment.find({
    academy: academyId,
    $or: [
      { section: sectionId },
      ...(markedAssessmentIds.length
        ? [{ _id: { $in: markedAssessmentIds } }]
        : []),
    ],
  })
    .populate("subject", "name")
    .populate("examTerm", "name session examDate passPercent createdAt")
    .populate("section", "name")
    .sort({ subjectName: 1 })
    .lean();

  const enroll = await enrollmentMap([student._id]);
  const enrolledIds = new Set(
    (enroll.get(String(student._id)) || []).map(String)
  );

  const markByAssessment = new Map(
    allStudentMarks.map((mark) => [String(mark.assessment), mark])
  );

  const byExam = new Map();
  for (const assessment of assessments) {
    const exam = assessment.examTerm;
    if (!exam?._id) continue;
    const subjectId = String(assessment.subject?._id || assessment.subject);
    const mark = markByAssessment.get(String(assessment._id));
    const entered = Boolean(
      mark && (mark.isAbsent || mark.obtainedMarks != null)
    );
    const isCurrentSection =
      String(assessment.section?._id || assessment.section) ===
      String(sectionId);

    // Current section: honor enrollment. Prior sections: only keep entered marks.
    if (isCurrentSection) {
      if (enrolledIds.size && !enrolledIds.has(subjectId) && !entered) {
        continue;
      }
    } else if (!entered) {
      continue;
    }

    const examKey = String(exam._id);
    if (!byExam.has(examKey)) {
      byExam.set(examKey, {
        exam,
        subjectsByName: new Map(),
        hasEnteredMarks: false,
        sectionName: assessment.section?.name || null,
      });
    }
    const bucket = byExam.get(examKey);
    if (entered) bucket.hasEnteredMarks = true;
    if (!bucket.sectionName && assessment.section?.name) {
      bucket.sectionName = assessment.section.name;
    }

    const subjectName = assessment.subject?.name || assessment.subjectName;
    const next = {
      name: subjectName,
      total: Number(assessment.totalMarks) || 0,
      obtained:
        !mark || mark.isAbsent || mark.obtainedMarks == null
          ? null
          : Number(mark.obtainedMarks),
      isAbsent: Boolean(mark?.isAbsent),
      entered,
    };

    // One row per subject name — prefer the assessment that has marks
    const key = String(subjectName || "").toLowerCase();
    const prev = bucket.subjectsByName.get(key);
    if (!prev) {
      bucket.subjectsByName.set(key, next);
    } else if (next.entered && !prev.entered) {
      bucket.subjectsByName.set(key, next);
    } else if (next.entered && prev.entered) {
      // Keep the more complete / higher-total assessment row
      if (next.total >= prev.total) bucket.subjectsByName.set(key, next);
    } else if (!prev.entered && next.total > prev.total) {
      bucket.subjectsByName.set(key, next);
    }
  }

  const buildExamBlock = ({ exam, subjectsByName }) => {
    const subjects = [...subjectsByName.values()];
    // Dash and Abs both count as 0; result always finalized when subjects exist
    const obtainedTotal = subjects.reduce((sum, s) => {
      if (s.isAbsent || !s.entered || s.obtained == null) return sum;
      return sum + (s.obtained ?? 0);
    }, 0);
    const maxTotal = subjects.reduce((sum, s) => sum + s.total, 0);
    const passPercent = Number(exam.passPercent) || 33;
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    const subjectsPass = subjects.every((s) => {
      // Abs or dash → subject FAIL (same rule)
      if (s.isAbsent || !s.entered || s.obtained == null) return false;
      const subjectPercent = percentOf(s.obtained ?? 0, s.total);
      return subjectPercent != null && subjectPercent >= passPercent;
    });
    const sortedSubjects = [...subjects].sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    );
    return {
      _id: exam._id,
      name: exam.name,
      session: exam.session,
      examDate: exam.examDate,
      createdAt: exam.createdAt,
      passPercent,
      subjects: sortedSubjects.map((s) => {
        const isZero = s.isAbsent || !s.entered || s.obtained == null;
        const subjectPercent = isZero
          ? percentOf(0, s.total)
          : percentOf(s.obtained, s.total);
        return {
          name: s.name,
          total: s.total,
          obtained: isZero ? 0 : s.obtained,
          isAbsent: s.isAbsent,
          entered: s.entered,
          percent: subjectPercent,
          grade: gradeFromPercent(subjectPercent),
          status: s.isAbsent
            ? "ABSENT"
            : !s.entered
              ? "FAIL"
              : subjectPercent >= passPercent
                ? "PASS"
                : "FAIL",
          displayTotal: formatResultMarks(s.total),
          displayObtained: s.isAbsent
            ? "Abs"
            : s.obtained == null
              ? "—"
              : formatResultMarks(s.obtained),
          displayPercent:
            subjectPercent == null
              ? "—"
              : formatResultPercent(subjectPercent),
        };
      }),
      obtainedTotal,
      maxTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed:
        subjects.length > 0 &&
        subjectsPass &&
        percent != null &&
        percent >= passPercent,
      complete: subjects.length > 0,
      displayObtained: formatResultMarks(obtainedTotal),
      displayTotal: maxTotal > 0 ? formatResultMarks(maxTotal) : "—",
      displayPercent: percent == null ? "—" : formatResultPercent(percent),
    };
  };

  // Every round this student has marks in (for accumulative summary)
  const allExams = [...byExam.values()]
    .filter((bucket) => bucket.hasEnteredMarks)
    .map(buildExamBlock)
    .sort(compareExamsByDate);

  const availableExams = allExams.map((exam) => ({
    _id: exam._id,
    name: exam.name,
    session: exam.session,
    passPercent: exam.passPercent,
    examDate: exam.examDate,
  }));

  if (requestedExamIds.length) {
    const known = new Set(allExams.map((exam) => String(exam._id)));
    for (const id of requestedExamIds) {
      if (!known.has(id)) {
        throw httpError(404, "One or more selected exams were not found");
      }
    }
  }

  // Detail subjects sheet: only the round(s) the user selected
  const selectedIds = requestedExamIds.length
    ? requestedExamIds
    : allExams.map((exam) => String(exam._id));

  const examsById = new Map(allExams.map((exam) => [String(exam._id), exam]));
  const exams = selectedIds
    .map((id) => examsById.get(String(id)))
    .filter(Boolean)
    .sort(compareExamsByDate);

  const academy = await Academy.findById(academyId)
    .select("name logo address phone email")
    .lean();

  const sessionLabel =
    exams[0]?.session ||
    allExams[0]?.session ||
    student.session ||
    currentAcademicSession();

  res.json({
    success: true,
    academy,
    student: {
      _id: student._id,
      name: student.name,
      fatherName: student.fatherName,
      rollNumber: student.rollNumber,
      group: student.group || null,
      class: student.class
        ? { _id: student.class._id, name: student.class.name }
        : null,
      section: student.section
        ? { _id: student.section._id, name: student.section.name }
        : null,
    },
    session: sessionLabel,
    availableExams,
    /** Selected round(s) — used for subjects evaluation detail */
    exams,
    /** All rounds this student appeared in — used for accumulative summary */
    accumulative: allExams.map((exam) => ({
      _id: exam._id,
      name: exam.name,
      session: exam.session,
      maxTotal: exam.maxTotal,
      obtainedTotal: exam.obtainedTotal,
      percent: exam.percent,
      grade: exam.grade,
      displayTotal: exam.displayTotal,
      displayObtained: exam.displayObtained,
      displayPercent: exam.displayPercent,
    })),
    groupLabels: GROUP_LABELS,
  });
});

/** GET /api/results/classes/:classId — sections under a class for hub drill-down */
export const getClassSections = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const schoolClass = await Class.findOne({
    _id: req.params.classId,
    academy: academyId,
  }).lean();
  if (!schoolClass) throw httpError(404, "Class not found");

  const sections = await Section.find({
    academy: academyId,
    class: schoolClass._id,
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  const counts = await Student.aggregate([
    {
      $match: {
        academy: academyId,
        section: { $in: sections.map((s) => s._id) },
        isActive: true,
      },
    },
    { $group: { _id: "$section", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    success: true,
    class: schoolClass,
    sections: sections.map((section) => ({
      ...section,
      studentCount: countMap.get(String(section._id)) || 0,
    })),
  });
});
