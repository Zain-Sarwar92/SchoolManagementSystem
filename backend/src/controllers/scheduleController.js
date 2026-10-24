import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import TestSchedule from "../models/TestSchedule.js";
import TestScheduleRound from "../models/TestScheduleRound.js";
import TestScheduleSubject from "../models/TestScheduleSubject.js";
import TestScheduleSubjectClass from "../models/TestScheduleSubjectClass.js";
import TestScheduleAssignment from "../models/TestScheduleAssignment.js";
import TestPaper from "../models/TestPaper.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { buildScheduleCatalog } from "../utils/scheduleCatalog.js";
import {
  formatScheduleDate,
  resolveAssignmentStatus,
} from "../utils/testScheduleStatus.js";

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseTestDate(raw, { allowPast = false } = {}) {
  const date = new Date(`${String(raw).trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const err = new Error("Invalid test date");
    err.statusCode = 400;
    throw err;
  }
  if (!allowPast && date < startOfLocalDay()) {
    const err = new Error(
      "Test dates must be today or a future date — past dates are not allowed"
    );
    err.statusCode = 400;
    throw err;
  }
  return date;
}

async function loadScheduleTree(scheduleId, academyId) {
  const schedule = await TestSchedule.findOne({
    _id: scheduleId,
    academy: academyId,
  })
    .populate("createdBy", "name")
    .lean();
  if (!schedule) return null;

  const rounds = await TestScheduleRound.find({ schedule: schedule._id })
    .sort({ order: 1, name: 1 })
    .lean();
  const roundIds = rounds.map((r) => r._id);
  const subjects = await TestScheduleSubject.find({ round: { $in: roundIds } })
    .sort({ testDate: 1, subjectName: 1 })
    .lean();
  const subjectIds = subjects.map((s) => s._id);
  const subjectClasses = await TestScheduleSubjectClass.find({
    scheduleSubject: { $in: subjectIds },
  })
    .populate("class", "name gradeLevel")
    .populate("subject", "name")
    .lean();
  const scIds = subjectClasses.map((s) => s._id);
  const assignments = await TestScheduleAssignment.find({
    scheduleSubjectClass: { $in: scIds },
  })
    .populate("teacher", "name email")
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const papers = assignmentIds.length
    ? await TestPaper.find({
        scheduleAssignment: { $in: assignmentIds },
      })
        .select("_id scheduleAssignment examDate title")
        .lean()
    : [];
  const paperByAssignment = new Map(
    papers.map((p) => [String(p.scheduleAssignment), p])
  );

  const assignmentsBySc = new Map();
  for (const row of assignments) {
    const key = String(row.scheduleSubjectClass);
    if (!assignmentsBySc.has(key)) assignmentsBySc.set(key, []);
    assignmentsBySc.get(key).push({
      ...row,
      test: paperByAssignment.get(String(row._id)) || null,
      coveredByTest: row.coveredByTest
        ? { _id: row.coveredByTest }
        : null,
    });
  }

  const classesBySubject = new Map();
  for (const row of subjectClasses) {
    const key = String(row.scheduleSubject);
    if (!classesBySubject.has(key)) classesBySubject.set(key, []);
    classesBySubject.get(key).push({
      ...row,
      assignments: (assignmentsBySc.get(String(row._id)) || []).sort((a, b) =>
        (a.teacher?.name || "").localeCompare(b.teacher?.name || "")
      ),
    });
  }

  const subjectsByRound = new Map();
  for (const row of subjects) {
    const key = String(row.round);
    if (!subjectsByRound.has(key)) subjectsByRound.set(key, []);
    subjectsByRound.get(key).push({
      ...row,
      classes: (classesBySubject.get(String(row._id)) || []).sort((a, b) =>
        (a.class?.name || "").localeCompare(b.class?.name || "", undefined, {
          numeric: true,
        })
      ),
    });
  }

  return {
    ...schedule,
    rounds: rounds.map((round) => ({
      ...round,
      subjects: subjectsByRound.get(String(round._id)) || [],
    })),
  };
}

function summarizeSchedule(tree) {
  const subjects = tree.rounds.flatMap((r) => r.subjects);
  const flat = subjects.flatMap((subjectItem) =>
    subjectItem.classes.flatMap((classItem) =>
      classItem.assignments.map((assignment) => ({
        assignment,
        testDate: subjectItem.testDate,
      }))
    )
  );
  const completed = flat.filter(
    (item) => item.assignment.test || item.assignment.coveredByTest
  ).length;
  const total = flat.length;
  const statuses = flat.map((item) =>
    resolveAssignmentStatus({
      testDate: item.testDate,
      hasCreatedTest: Boolean(
        item.assignment.test || item.assignment.coveredByTest
      ),
      completedAt: item.assignment.completedAt,
    })
  );
  return {
    subjectsCount: subjects.length,
    roundsCount: tree.rounds.length,
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    overdue: statuses.filter((s) => s === "OVERDUE").length,
    upcoming: statuses.filter((s) => s === "UPCOMING").length,
    earliestDate: subjects[0]?.testDate || null,
  };
}

export const getScheduleCatalog = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const catalog = await buildScheduleCatalog(academyId);
  const sectionCount = catalog.reduce(
    (sum, board) =>
      sum +
      board.classes.reduce((n, klass) => n + (klass.sections?.length || 0), 0),
    0
  );
  res.json({
    success: true,
    catalog,
    hasAnySection: sectionCount > 0,
  });
});

export const listSchedules = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const schedules = await TestSchedule.find({ academy: academyId })
    .sort({ createdAt: -1 })
    .lean();

  const trees = [];
  for (const schedule of schedules) {
    const tree = await loadScheduleTree(schedule._id, academyId);
    if (!tree) continue;
    trees.push({
      ...tree,
      summary: summarizeSchedule(tree),
    });
  }

  res.json({ success: true, schedules: trees });
});

export const getSchedule = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const tree = await loadScheduleTree(req.params.id, academyId);
  if (!tree) {
    res.status(404);
    throw new Error("Schedule not found");
  }
  res.json({
    success: true,
    schedule: { ...tree, summary: summarizeSchedule(tree) },
  });
});

async function validateSchedulePayload(academyId, rounds) {
  const allSubjectIds = new Set();
  const allTeacherIds = new Set();
  const allSectionIds = new Set();
  const allClassIds = new Set();

  for (const round of rounds) {
    for (const subjectItem of round.subjects || []) {
      for (const assignment of subjectItem.classAssignments || []) {
        allClassIds.add(String(assignment.classId));
        allSubjectIds.add(String(assignment.subjectId));
        for (const sectionAssignment of assignment.sectionAssignments || []) {
          if (sectionAssignment.teacherId) {
            allTeacherIds.add(String(sectionAssignment.teacherId));
          }
          allSectionIds.add(String(sectionAssignment.sectionId));
        }
      }
    }
  }

  const [subjects, teachers, sections, mappings] = await Promise.all([
    Subject.find({ _id: { $in: [...allSubjectIds] } }).lean(),
    allTeacherIds.size
      ? User.find({
          _id: { $in: [...allTeacherIds] },
          academy: academyId,
          role: "teacher",
          isActive: true,
        }).lean()
      : Promise.resolve([]),
    Section.find({
      _id: { $in: [...allSectionIds] },
      academy: academyId,
    }).lean(),
    allTeacherIds.size
      ? TeacherAssignment.find({
          academy: academyId,
          subject: { $in: [...allSubjectIds] },
          teacher: { $in: [...allTeacherIds] },
          section: { $in: [...allSectionIds] },
        }).lean()
      : Promise.resolve([]),
  ]);

  const classes = await Class.find({
    _id: { $in: [...allClassIds] },
    academy: academyId,
  }).lean();

  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const teacherById = new Map(teachers.map((t) => [String(t._id), t]));
  const sectionById = new Map(sections.map((s) => [String(s._id), s]));
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const mappingKeys = new Set(
    mappings.map((m) => `${m.teacher}:${m.class}:${m.section}:${m.subject}`)
  );

  for (const round of rounds) {
    if (!Array.isArray(round.subjects) || round.subjects.length === 0) {
      const err = new Error(
        `Round "${round.name || "Round"}" must include at least one subject`
      );
      err.statusCode = 400;
      throw err;
    }
    const seen = new Set();
    for (const subjectItem of round.subjects || []) {
      parseTestDate(subjectItem.testDate);
      const key = `${subjectItem.subjectName.trim().toLowerCase()}|${subjectItem.testDate}`;
      if (seen.has(key)) {
        const err = new Error(
          `Duplicate date for ${subjectItem.subjectName} on ${subjectItem.testDate} in ${round.name}`
        );
        err.statusCode = 400;
        throw err;
      }
      seen.add(key);

      const classIds = new Set();
      for (const assignment of subjectItem.classAssignments || []) {
        if (classIds.has(String(assignment.classId))) {
          const err = new Error(
            `Duplicate class for ${subjectItem.subjectName} in ${round.name}`
          );
          err.statusCode = 400;
          throw err;
        }
        classIds.add(String(assignment.classId));

        const subject = subjectById.get(String(assignment.subjectId));
        const klass = classById.get(String(assignment.classId));
        if (!subject || !klass) {
          const err = new Error("Subject or class mapping not found");
          err.statusCode = 400;
          throw err;
        }
        if (subject.name !== subjectItem.subjectName) {
          const err = new Error(
            `Selected subject does not match ${subjectItem.subjectName}`
          );
          err.statusCode = 400;
          throw err;
        }

        const uniqueSections = new Set();
        for (const sectionAssignment of assignment.sectionAssignments || []) {
          const section = sectionById.get(String(sectionAssignment.sectionId));
          if (!section) {
            const err = new Error("Section not found");
            err.statusCode = 400;
            throw err;
          }
          if (String(section.class) !== String(assignment.classId)) {
            const err = new Error(
              `Section ${section.name} does not belong to ${klass.name}`
            );
            err.statusCode = 400;
            throw err;
          }
          if (uniqueSections.has(String(section._id))) {
            const err = new Error(
              `Duplicate section for ${subjectItem.subjectName} · ${klass.name}`
            );
            err.statusCode = 400;
            throw err;
          }
          uniqueSections.add(String(section._id));

          // Teachers are optional — only validate when a teacherId is sent
          const teacherId = sectionAssignment.teacherId
            ? String(sectionAssignment.teacherId)
            : "";
          if (!teacherId) continue;

          const teacher = teacherById.get(teacherId);
          if (!teacher) {
            const err = new Error(
              "One or more teachers are inactive or outside this academy"
            );
            err.statusCode = 400;
            throw err;
          }
          const eligibilityKey = `${teacher._id}:${assignment.classId}:${section._id}:${assignment.subjectId}`;
          if (!mappingKeys.has(eligibilityKey)) {
            const err = new Error(
              `${teacher.name} is not assigned to ${klass.name} · ${section.name} · ${subject.name}`
            );
            err.statusCode = 400;
            throw err;
          }
        }
      }
    }
  }

  return { sectionById };
}

export const createSchedule = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = String(req.body.name || "").trim();
  const rounds = Array.isArray(req.body.rounds) ? req.body.rounds : [];

  if (name.length < 2) {
    res.status(400);
    throw new Error("Enter a schedule name");
  }
  if (!rounds.length) {
    res.status(400);
    throw new Error("Add at least one round");
  }

  const { sectionById } = await validateSchedulePayload(academyId, rounds);

  const schedule = await TestSchedule.create({
    academy: academyId,
    name,
    createdBy: req.user._id,
    status: "ACTIVE",
  });

  try {
    for (const round of rounds) {
      const roundDoc = await TestScheduleRound.create({
        schedule: schedule._id,
        name: String(round.name || "Round").trim(),
        order: Number(round.order) || 0,
      });

      for (const subjectItem of round.subjects || []) {
        const subjectDoc = await TestScheduleSubject.create({
          round: roundDoc._id,
          subjectName: subjectItem.subjectName.trim(),
          testDate: parseTestDate(subjectItem.testDate),
        });

        for (const assignment of subjectItem.classAssignments || []) {
          const scDoc = await TestScheduleSubjectClass.create({
            scheduleSubject: subjectDoc._id,
            class: assignment.classId,
            subject: assignment.subjectId,
          });

          const assignmentDocs = (assignment.sectionAssignments || []).map(
            (sectionAssignment) => ({
              scheduleSubjectClass: scDoc._id,
              teacher: sectionAssignment.teacherId || null,
              section: sectionAssignment.sectionId,
              sectionName:
                sectionById.get(String(sectionAssignment.sectionId))?.name ||
                "",
            })
          );
          if (assignmentDocs.length) {
            await TestScheduleAssignment.insertMany(assignmentDocs);
          }
        }
      }
    }
  } catch (error) {
    // Best-effort cleanup if create fails mid-way (standalone Mongo has no txn).
    const roundsCreated = await TestScheduleRound.find({
      schedule: schedule._id,
    }).lean();
    const roundIds = roundsCreated.map((r) => r._id);
    const subjectsCreated = await TestScheduleSubject.find({
      round: { $in: roundIds },
    }).lean();
    const subjectIds = subjectsCreated.map((s) => s._id);
    const scCreated = await TestScheduleSubjectClass.find({
      scheduleSubject: { $in: subjectIds },
    }).lean();
    const scIds = scCreated.map((s) => s._id);
    await TestScheduleAssignment.deleteMany({
      scheduleSubjectClass: { $in: scIds },
    });
    await TestScheduleSubjectClass.deleteMany({ _id: { $in: scIds } });
    await TestScheduleSubject.deleteMany({ _id: { $in: subjectIds } });
    await TestScheduleRound.deleteMany({ _id: { $in: roundIds } });
    await TestSchedule.deleteOne({ _id: schedule._id });
    throw error;
  }

  const tree = await loadScheduleTree(schedule._id, academyId);
  res.status(201).json({
    success: true,
    schedule: { ...tree, summary: summarizeSchedule(tree) },
  });
});

export const cancelSchedule = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const schedule = await TestSchedule.findOne({
    _id: req.params.id,
    academy: academyId,
  });
  if (!schedule) {
    res.status(404);
    throw new Error("Schedule not found");
  }
  schedule.status = "CANCELLED";
  await schedule.save();
  res.json({ success: true, message: "Schedule cancelled" });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const schedule = await TestSchedule.findOne({
    _id: req.params.id,
    academy: academyId,
  });
  if (!schedule) {
    res.status(404);
    throw new Error("Schedule not found");
  }

  const rounds = await TestScheduleRound.find({ schedule: schedule._id }).lean();
  const roundIds = rounds.map((r) => r._id);
  const subjects = await TestScheduleSubject.find({
    round: { $in: roundIds },
  }).lean();
  const subjectIds = subjects.map((s) => s._id);
  const subjectClasses = await TestScheduleSubjectClass.find({
    scheduleSubject: { $in: subjectIds },
  }).lean();
  const scIds = subjectClasses.map((s) => s._id);
  const assignments = await TestScheduleAssignment.find({
    scheduleSubjectClass: { $in: scIds },
  }).lean();
  const assignmentIds = assignments.map((a) => a._id);

  await TestPaper.updateMany(
    { scheduleAssignment: { $in: assignmentIds } },
    { $unset: { scheduleAssignment: 1 } }
  );
  await TestScheduleAssignment.deleteMany({ _id: { $in: assignmentIds } });
  await TestScheduleSubjectClass.deleteMany({ _id: { $in: scIds } });
  await TestScheduleSubject.deleteMany({ _id: { $in: subjectIds } });
  await TestScheduleRound.deleteMany({ _id: { $in: roundIds } });
  await schedule.deleteOne();

  res.json({ success: true, message: "Schedule deleted" });
});

/** Teacher: my assigned schedule rows */
export const listMyAssignments = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const teacherId = req.user._id;

  const assignments = await TestScheduleAssignment.find({
    teacher: teacherId,
  }).lean();

  if (!assignments.length) {
    return res.json({ success: true, assignments: [] });
  }

  const scIds = assignments.map((a) => a.scheduleSubjectClass);
  const subjectClasses = await TestScheduleSubjectClass.find({
    _id: { $in: scIds },
  })
    .populate("class", "name")
    .populate("subject", "name")
    .lean();
  const scById = new Map(subjectClasses.map((s) => [String(s._id), s]));

  const subjectIds = [
    ...new Set(subjectClasses.map((s) => String(s.scheduleSubject))),
  ];
  const subjects = await TestScheduleSubject.find({
    _id: { $in: subjectIds },
  }).lean();
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));

  const roundIds = [...new Set(subjects.map((s) => String(s.round)))];
  const rounds = await TestScheduleRound.find({ _id: { $in: roundIds } }).lean();
  const roundById = new Map(rounds.map((r) => [String(r._id), r]));

  const scheduleIds = [...new Set(rounds.map((r) => String(r.schedule)))];
  const schedules = await TestSchedule.find({
    _id: { $in: scheduleIds },
    academy: academyId,
  }).lean();
  const scheduleById = new Map(schedules.map((s) => [String(s._id), s]));

  const papers = await TestPaper.find({
    scheduleAssignment: { $in: assignments.map((a) => a._id) },
  }).lean();
  const paperByAssignment = new Map(
    papers.map((p) => [String(p.scheduleAssignment), p])
  );

  const rows = [];
  for (const assignment of assignments) {
    const sc = scById.get(String(assignment.scheduleSubjectClass));
    if (!sc) continue;
    const subjectItem = subjectById.get(String(sc.scheduleSubject));
    if (!subjectItem) continue;
    const round = roundById.get(String(subjectItem.round));
    if (!round) continue;
    const schedule = scheduleById.get(String(round.schedule));
    if (!schedule || schedule.status === "CANCELLED") continue;

    const test = paperByAssignment.get(String(assignment._id)) || null;
    const status = resolveAssignmentStatus({
      testDate: subjectItem.testDate,
      hasCreatedTest: Boolean(test || assignment.coveredByTest),
      completedAt: assignment.completedAt,
    });

    rows.push({
      assignmentId: assignment._id,
      scheduleId: schedule._id,
      scheduleName: schedule.name,
      roundName: round.name,
      subjectName: subjectItem.subjectName,
      subjectId: sc.subject?._id || sc.subject,
      className: sc.class?.name || "—",
      classId: sc.class?._id || sc.class,
      sectionName: assignment.sectionName,
      sectionId: assignment.section,
      testDate: subjectItem.testDate,
      testDateLabel: formatScheduleDate(subjectItem.testDate),
      syllabusText: assignment.syllabusText || "",
      status,
      test: test
        ? {
            _id: test._id,
            title: test.title,
            examDate: test.examDate,
            totalMarks: test.totalMarks,
          }
        : null,
    });
  }

  const rank = { OVERDUE: 0, PENDING: 1, UPCOMING: 2, COMPLETED: 3 };
  rows.sort(
    (a, b) =>
      (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
      new Date(a.testDate) - new Date(b.testDate)
  );

  res.json({ success: true, assignments: rows });
});

export const updateMySyllabus = asyncHandler(async (req, res) => {
  const assignment = await TestScheduleAssignment.findOne({
    _id: req.params.assignmentId,
    teacher: req.user._id,
  });
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }
  assignment.syllabusText = String(req.body.syllabusText || "").trim();
  await assignment.save();
  res.json({ success: true, syllabusText: assignment.syllabusText });
});

/** Academy admin: edit syllabus on any schedule assignment */
export const updateAssignmentSyllabus = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const assignment = await TestScheduleAssignment.findById(
    req.params.assignmentId
  ).lean();
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  const sc = await TestScheduleSubjectClass.findById(
    assignment.scheduleSubjectClass
  ).lean();
  if (!sc) {
    res.status(404);
    throw new Error("Assignment mapping not found");
  }
  const subjectItem = await TestScheduleSubject.findById(sc.scheduleSubject).lean();
  const round = subjectItem
    ? await TestScheduleRound.findById(subjectItem.round).lean()
    : null;
  const schedule = round
    ? await TestSchedule.findOne({
        _id: round.schedule,
        academy: academyId,
      }).lean()
    : null;
  if (!schedule) {
    res.status(404);
    throw new Error("Schedule not found for this academy");
  }

  const updated = await TestScheduleAssignment.findByIdAndUpdate(
    assignment._id,
    { $set: { syllabusText: String(req.body.syllabusText || "").trim() } },
    { new: true }
  );
  res.json({
    success: true,
    syllabusText: updated.syllabusText,
    assignmentId: updated._id,
  });
});

export const createPaperForAssignment = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const assignment = await TestScheduleAssignment.findOne({
    _id: req.params.assignmentId,
    teacher: req.user._id,
  });
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  const existing = await TestPaper.findOne({
    scheduleAssignment: assignment._id,
  });
  if (existing) {
    res.status(400);
    throw new Error("Paper already created for this assignment");
  }

  const sc = await TestScheduleSubjectClass.findById(
    assignment.scheduleSubjectClass
  )
    .populate("class", "name")
    .populate("subject", "name")
    .lean();
  if (!sc) {
    res.status(404);
    throw new Error("Schedule mapping not found");
  }
  const subjectItem = await TestScheduleSubject.findById(
    sc.scheduleSubject
  ).lean();
  const round = subjectItem
    ? await TestScheduleRound.findById(subjectItem.round).lean()
    : null;
  const schedule = round
    ? await TestSchedule.findOne({
        _id: round.schedule,
        academy: academyId,
      }).lean()
    : null;

  if (!schedule || schedule.status === "CANCELLED") {
    res.status(400);
    throw new Error("Schedule is cancelled or missing");
  }

  const title =
    String(req.body.title || "").trim() ||
    `${subjectItem.subjectName} — ${schedule.name}`;
  const paper = await TestPaper.create({
    academy: academyId,
    teacher: req.user._id,
    title,
    instructions: String(req.body.instructions || "").trim(),
    totalMarks: Number(req.body.totalMarks) || 0,
    durationMinutes: Number(req.body.durationMinutes) || 60,
    examDate: subjectItem.testDate,
    classSection: `${sc.class?.name || ""} ${assignment.sectionName || ""}`.trim(),
    subject: sc.subject?._id || sc.subject,
    syllabusNote:
      String(req.body.syllabusNote || assignment.syllabusText || "").trim(),
    scheduleAssignment: assignment._id,
  });

  assignment.completedAt = new Date();
  if (req.body.syllabusNote != null) {
    assignment.syllabusText = String(req.body.syllabusNote || "").trim();
  }
  await assignment.save();

  res.status(201).json({ success: true, paper });
});

export const deletePaperForAssignment = asyncHandler(async (req, res) => {
  const assignment = await TestScheduleAssignment.findOne({
    _id: req.params.assignmentId,
    teacher: req.user._id,
  });
  if (!assignment) {
    res.status(404);
    throw new Error("Assignment not found");
  }

  const paper = await TestPaper.findOne({
    scheduleAssignment: assignment._id,
    teacher: req.user._id,
  });
  if (!paper) {
    res.status(404);
    throw new Error("Paper not found");
  }

  await paper.deleteOne();
  assignment.completedAt = null;
  await assignment.save();

  res.json({ success: true, message: "Paper deleted — assignment reopened" });
});
