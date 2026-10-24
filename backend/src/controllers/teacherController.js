import User from "../models/User.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import {
  TEACHER_LEVELS,
  classMatchesTeacherLevel,
  teacherLevelLabel,
} from "../utils/teacherLevel.js";
import { buildScheduleCatalog } from "../utils/scheduleCatalog.js";
import { logActivity } from "../utils/logActivity.js";

function serializeTeacher(user, assignments = []) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    teacherLevel: user.teacherLevel,
    teacherLevelLabel: teacherLevelLabel(user.teacherLevel),
    isActive: user.isActive,
    createdAt: user.createdAt,
    assignments: assignments.map((row) => ({
      _id: row._id,
      class: row.class
        ? { _id: row.class._id, name: row.class.name, gradeLevel: row.class.gradeLevel }
        : null,
      section: row.section
        ? { _id: row.section._id, name: row.section.name }
        : null,
      subject: row.subject
        ? { _id: row.subject._id, name: row.subject.name }
        : null,
    })),
  };
}

export const listTeacherLevels = asyncHandler(async (_req, res) => {
  res.json({ success: true, levels: TEACHER_LEVELS });
});

export const listTeachers = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const includeInactive = req.query.includeInactive === "1";

  const filter = { academy: academyId, role: "teacher" };
  if (!includeInactive) filter.isActive = true;

  const teachers = await User.find(filter).sort({ name: 1 }).lean();
  const ids = teachers.map((t) => t._id);
  const assignments = await TeacherAssignment.find({
    academy: academyId,
    teacher: { $in: ids },
  })
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .populate("subject", "name")
    .lean();

  const byTeacher = new Map();
  for (const row of assignments) {
    const key = String(row.teacher);
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key).push(row);
  }

  res.json({
    success: true,
    teachers: teachers.map((t) =>
      serializeTeacher(t, byTeacher.get(String(t._id)) || [])
    ),
  });
});

export const getTeacher = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const teacher = await User.findOne({
    _id: req.params.id,
    academy: academyId,
    role: "teacher",
  }).lean();
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }
  const assignments = await TeacherAssignment.find({
    academy: academyId,
    teacher: teacher._id,
  })
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .populate("subject", "name")
    .lean();

  res.json({ success: true, teacher: serializeTeacher(teacher, assignments) });
});

export const getTeacherAssignmentOptions = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const level = String(req.query.level || "").toUpperCase();
  if (!["PRIMARY", "MATRIC", "INTERMEDIATE"].includes(level)) {
    res.status(400);
    throw new Error("Teacher level is required");
  }

  const catalog = await buildScheduleCatalog(academyId);
  const board = catalog[0];
  const classes = (board?.classes || [])
    .filter((klass) =>
      classMatchesTeacherLevel(klass.className, level, klass.gradeLevel)
    )
    .map((klass) => ({
      classId: klass.classId,
      className: klass.className,
      sections: klass.sections,
      subjects: klass.subjects.map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
      })),
    }));

  res.json({ success: true, classes });
});

async function replaceAssignments({ academyId, teacherId, assignments }) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const uniqueKeys = new Set();
  const docs = [];

  for (const row of rows) {
    const classId = row.classId || row.class;
    const sectionId = row.sectionId || row.section;
    const subjectId = row.subjectId || row.subject;
    if (!classId || !sectionId || !subjectId) {
      const err = new Error("Each assignment needs class, section, and subject");
      err.statusCode = 400;
      throw err;
    }
    const key = `${classId}:${sectionId}:${subjectId}`;
    if (uniqueKeys.has(key)) continue;
    uniqueKeys.add(key);

    const [klass, section, subject] = await Promise.all([
      Class.findOne({ _id: classId, academy: academyId, isActive: true }),
      Section.findOne({ _id: sectionId, academy: academyId, isActive: true }),
      Subject.findById(subjectId),
    ]);
    if (!klass || !section || !subject) {
      const err = new Error("Invalid class, section, or subject in assignments");
      err.statusCode = 400;
      throw err;
    }
    if (String(section.class) !== String(klass._id)) {
      const err = new Error(
        `Section ${section.name} does not belong to ${klass.name}`
      );
      err.statusCode = 400;
      throw err;
    }
    docs.push({
      academy: academyId,
      teacher: teacherId,
      class: klass._id,
      section: section._id,
      subject: subject._id,
    });
  }

  await TeacherAssignment.deleteMany({ academy: academyId, teacher: teacherId });
  if (docs.length) await TeacherAssignment.insertMany(docs);
  return TeacherAssignment.find({ academy: academyId, teacher: teacherId })
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .populate("subject", "name")
    .lean();
}

export const createTeacher = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { name, email, password, teacherLevel, assignments } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }
  const emailNorm = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    res.status(400);
    throw new Error("Enter a valid email address");
  }
  const level = ["PRIMARY", "MATRIC", "INTERMEDIATE"].includes(teacherLevel)
    ? teacherLevel
    : "MATRIC";
  if (String(password).length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await User.findOne({ email: emailNorm });
  if (existing) {
    res.status(400);
    throw new Error("Email already registered");
  }

  const teacher = await User.create({
    name: name.trim(),
    email: emailNorm,
    password,
    role: "teacher",
    teacherLevel: level,
    academy: academyId,
    isActive: true,
  });

  const savedAssignments = await replaceAssignments({
    academyId,
    teacherId: teacher._id,
    assignments,
  });

  void logActivity({
    user: req.user,
    academyId,
    action: "TEACHER_CREATE",
    summary: `Created sub account “${teacher.name}” (${teacher.email})`,
    meta: {
      teacherId: String(teacher._id),
      name: teacher.name,
      email: teacher.email,
      teacherLevel: level,
    },
  });

  res.status(201).json({
    success: true,
    teacher: serializeTeacher(teacher.toObject(), savedAssignments),
  });
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const teacher = await User.findOne({
    _id: req.params.id,
    academy: academyId,
    role: "teacher",
  });
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }

  const { name, email, password, teacherLevel, isActive, assignments } =
    req.body;

  if (name?.trim()) teacher.name = name.trim();
  if (email?.trim()) {
    const nextEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      res.status(400);
      throw new Error("Enter a valid email address");
    }
    const clash = await User.findOne({
      email: nextEmail,
      _id: { $ne: teacher._id },
    });
    if (clash) {
      res.status(400);
      throw new Error("Email already registered");
    }
    teacher.email = nextEmail;
  }
  if (teacherLevel) {
    if (!["PRIMARY", "MATRIC", "INTERMEDIATE"].includes(teacherLevel)) {
      res.status(400);
      throw new Error("Invalid teacher type");
    }
    teacher.teacherLevel = teacherLevel;
  }
  if (typeof isActive === "boolean") teacher.isActive = isActive;
  if (password) {
    if (String(password).length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters");
    }
    teacher.password = password;
  }

  await teacher.save();

  let savedAssignments;
  if (Array.isArray(assignments)) {
    savedAssignments = await replaceAssignments({
      academyId,
      teacherId: teacher._id,
      assignments,
    });
  } else {
    savedAssignments = await TeacherAssignment.find({
      academy: academyId,
      teacher: teacher._id,
    })
      .populate("class", "name gradeLevel")
      .populate("section", "name")
      .populate("subject", "name")
      .lean();
  }

  void logActivity({
    user: req.user,
    academyId,
    action: "TEACHER_UPDATE",
    summary: `Updated teacher “${teacher.name}” (${teacher.email})`,
    meta: {
      teacherId: String(teacher._id),
      name: teacher.name,
      email: teacher.email,
      teacherLevel: teacher.teacherLevel,
      isActive: teacher.isActive,
    },
  });

  res.json({
    success: true,
    teacher: serializeTeacher(teacher.toObject(), savedAssignments),
  });
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const teacher = await User.findOne({
    _id: req.params.id,
    academy: academyId,
    role: "teacher",
  });
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }
  if (teacher.isActive) {
    res.status(400);
    throw new Error("Deactivate the teacher before deleting");
  }

  const snapshot = {
    teacherId: String(teacher._id),
    name: teacher.name,
    email: teacher.email,
  };

  await TeacherAssignment.deleteMany({
    academy: academyId,
    teacher: teacher._id,
  });
  await teacher.deleteOne();

  void logActivity({
    user: req.user,
    academyId,
    action: "TEACHER_DELETE",
    summary: `Deleted teacher “${snapshot.name}” (${snapshot.email})`,
    meta: snapshot,
  });

  res.json({ success: true, message: "Teacher deleted" });
});
