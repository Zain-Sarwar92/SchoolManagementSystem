import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import CustomField from "../models/CustomField.js";
import "../models/Subject.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import {
  GROUP_LABELS,
  SCIENCE_GRADES,
  isGroupValidForGrade,
  groupsForGrade,
} from "../constants/scienceCurriculum.js";
import {
  GROUP_LABELS as ALL_GROUP_LABELS,
  groupsForMajor,
  isGroupValidForMajor,
  MAJOR_LABELS,
  MAJORS,
  resolveClassGrade,
} from "../constants/majors.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { currentPeriodKey } from "../utils/feeHelpers.js";
import { recordFeeCollection } from "../utils/feeCollection.js";
import {
  suggestNextRollNumber,
  syncStudentSubjects,
} from "../utils/studentEnrollment.js";
import { parseSession, resolveSession, nextSessionLabel } from "../utils/academicSession.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const NEXT_GROUP = {
  biology: { 10: "biology", 11: "pre_medical", 12: "pre_medical" },
  computer: { 10: "computer", 11: "pre_engineering", 12: "pre_engineering" },
  pre_medical: { 12: "pre_medical" },
  pre_engineering: { 12: "pre_engineering" },
  ics: { 12: "ics" },
};

const suggestedGroup = (currentGroup, nextGrade, major) => {
  if (major === "arts") return currentGroup;
  const mapped = NEXT_GROUP[currentGroup]?.[nextGrade];
  if (mapped) return mapped;
  const allowed = groupsForGrade(nextGrade);
  return allowed.includes(currentGroup) ? currentGroup : allowed[0] || currentGroup;
};

const mapToObject = (mapLike) => {
  if (!mapLike) return {};
  if (mapLike instanceof Map) return Object.fromEntries(mapLike);
  if (typeof mapLike === "object") return { ...mapLike };
  return {};
};

const parseSectionIds = (query) => {
  const raw = query.sectionIds || query.sectionId || "";
  if (Array.isArray(raw)) return raw.map(String).map((id) => id.trim()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

/** Attach enrolled subjects in one query (no N+1). */
const attachSubjects = async (students, { includeSubjects = true } = {}) => {
  if (!students.length) return [];

  if (!includeSubjects) {
    return students.map((student) => ({
      ...student,
      customFields: mapToObject(student.customFields),
      enrolledSubjects: [],
    }));
  }

  const rows = await StudentSubject.find({
    student: { $in: students.map((s) => s._id) },
  })
    .populate("subject", "name code")
    .lean();

  const byStudent = new Map();
  for (const row of rows) {
    const key = String(row.student);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push({
      _id: row._id,
      subject: row.subject,
      group: row.group,
    });
  }

  return students.map((student) => ({
    ...student,
    customFields: mapToObject(student.customFields),
    enrolledSubjects: byStudent.get(String(student._id)) || [],
  }));
};

const formatStudent = async (student) => {
  const [formatted] = await attachSubjects([student], { includeSubjects: true });
  return formatted;
};

const digitsOnly = (phone) => (phone.match(/\d/g) || []).length;

const parseCustomFieldValues = async (academyId, rawValues = {}) => {
  const definitions = await CustomField.find({
    academy: academyId,
    module: "student",
    isActive: true,
  }).lean();

  const values = {};

  for (const field of definitions) {
    let value = rawValues?.[field.key];

    if (field.type === "checkbox") {
      value = value === true || value === "true" || value === "on" || value === 1;
      if (field.required && !value) {
        const err = new Error(`${field.label} is required`);
        err.statusCode = 400;
        throw err;
      }
      values[field.key] = Boolean(value);
      continue;
    }

    if (value == null || value === "") {
      if (field.required) {
        const err = new Error(`${field.label} is required`);
        err.statusCode = 400;
        throw err;
      }
      continue;
    }

    if (field.type === "file") {
      if (typeof value === "object" && value?.url) {
        values[field.key] = {
          url: String(value.url).trim(),
          originalName: String(value.originalName || "").trim(),
        };
      } else if (typeof value === "string" && value.trim()) {
        values[field.key] = { url: value.trim(), originalName: "" };
      } else if (field.required) {
        const err = new Error(`${field.label} is required`);
        err.statusCode = 400;
        throw err;
      }
      continue;
    }

    if (field.type === "number" || field.type === "range") {
      const num = Number(value);
      if (Number.isNaN(num)) {
        const err = new Error(`${field.label} must be a number`);
        err.statusCode = 400;
        throw err;
      }
      if (field.min != null && num < field.min) {
        const err = new Error(`${field.label} must be at least ${field.min}`);
        err.statusCode = 400;
        throw err;
      }
      if (field.max != null && num > field.max) {
        const err = new Error(`${field.label} must be at most ${field.max}`);
        err.statusCode = 400;
        throw err;
      }
      values[field.key] = num;
      continue;
    }

    values[field.key] = value;
  }

  return values;
};

export const getStudents = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const filter = { academy: academyId };

  const sectionIds = parseSectionIds(req.query);
  if (sectionIds.length === 1) filter.section = sectionIds[0];
  else if (sectionIds.length > 1) filter.section = { $in: sectionIds };

  if (req.query.classId) filter.class = req.query.classId;
  const session = parseSession(req.query.session);
  if (session) filter.session = session;
  if (req.query.group) filter.group = req.query.group;
  if (req.query.major) filter.major = req.query.major;
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;

  const q = (req.query.q || "").trim();
  if (q) {
    filter.$or = [
      { name: new RegExp(escapeRegex(q), "i") },
      { fatherName: new RegExp(escapeRegex(q), "i") },
      { rollNumber: new RegExp(escapeRegex(q), "i") },
      { phone: new RegExp(escapeRegex(q), "i") },
      { cnicOrBForm: new RegExp(escapeRegex(q), "i") },
    ];
  }

  const fields = String(req.query.fields || "").toLowerCase();
  const isPrint = fields === "print";
  const includeSubjects =
    !isPrint && String(req.query.includeSubjects || "1") !== "0";

  let query = Student.find(filter)
    .populate("class", "name gradeLevel")
    .populate("section", "name")
    .sort({ rollNumber: 1, name: 1 });

  if (isPrint) {
    query = query.select("name fatherName rollNumber section class isActive");
  }

  const students = await query.lean();
  const withSubjects = await attachSubjects(students, { includeSubjects });

  let result = withSubjects;
  const limitRaw = Number(req.query.limit);
  if (Number.isFinite(limitRaw) && limitRaw > 0) {
    result = withSubjects.slice(0, Math.min(limitRaw, 100));
  }

  res.json({
    success: true,
    count: result.length,
    totalMatched: withSubjects.length,
    students: result,
  });
});

export const getStudent = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const student = await Student.findOne({
    _id: req.params.id,
    academy: academyId,
  })
    .populate("class", "name")
    .populate("section", "name")
    .lean();

  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  res.json({ success: true, student: await formatStudent(student) });
});

export const getNextRoll = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const sectionId = req.params.sectionId;

  const section = await Section.findOne({ _id: sectionId, academy: academyId }).populate(
    "class",
    "name"
  );
  if (!section) {
    res.status(404);
    throw new Error("Section not found");
  }

  const session = resolveSession(req.query.session);
  const result = await suggestNextRollNumber(Student, academyId, sectionId, {
    className: section.class?.name || "",
    sectionName: section.name || "",
    session,
  });
  res.json({ success: true, ...result });
});

/** Groups for a class + major — Science uses Class.gradeLevel (name as fallback) */
export const getGroupsForClass = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const major = String(req.query.major || "science").toLowerCase();

  if (!MAJORS.includes(major)) {
    res.status(400);
    throw new Error("Major must be Science or Arts");
  }

  const schoolClass = await Class.findOne({
    _id: req.params.classId,
    academy: academyId,
  }).lean();

  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  if (major === "arts") {
    const groups = groupsForMajor("arts").map((value) => ({
      value,
      label: ALL_GROUP_LABELS[value] || value,
    }));
    return res.json({
      success: true,
      major,
      gradeLevel: null,
      groups,
    });
  }

  const grade = resolveClassGrade(schoolClass);

  if (!grade) {
    return res.json({
      success: true,
      major,
      gradeLevel: null,
      groups: [],
      message:
        'Name the class with a grade (e.g. "Class 9") to load Science groups',
    });
  }

  if (!SCIENCE_GRADES.includes(grade)) {
    return res.json({
      success: true,
      major,
      gradeLevel: grade,
      groups: [],
      message: `Science groups are for grades 9–12 (this class is grade ${grade})`,
    });
  }

  const groups = groupsForGrade(grade).map((value) => ({
    value,
    label: GROUP_LABELS[value] || value,
  }));

  res.json({
    success: true,
    major,
    gradeLevel: grade,
    groups,
  });
});

const resolveScienceGrade = (schoolClass, group) => {
  const grade = resolveClassGrade(schoolClass);

  if (!grade) {
    const error = new Error(
      'Name the class with a grade number (e.g. "Class 9") so Science subjects can enroll'
    );
    error.statusCode = 400;
    throw error;
  }

  if (!SCIENCE_GRADES.includes(grade)) {
    const error = new Error(
      `Science enrollment needs class grade 9–12 (class "${schoolClass.name}" is grade ${grade})`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isGroupValidForGrade(group, grade)) {
    const allowed = groupsForGrade(grade)
      .map((g) => GROUP_LABELS[g] || g)
      .join(", ");
    const error = new Error(
      `Group "${GROUP_LABELS[group] || group}" is not valid for grade ${grade} (${schoolClass.name}). Allowed: ${allowed}`
    );
    error.statusCode = 400;
    throw error;
  }

  return grade;
};

export const createStudent = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = req.body.name.trim();
  const fatherName = req.body.fatherName.trim();
  const phone = req.body.phone.trim();
  const guardianPhone = (req.body.guardianPhone || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const gender = req.body.gender;
  const dateOfBirth = req.body.dateOfBirth || null;
  const cnicOrBForm = (req.body.cnicOrBForm || "").trim();
  const address = req.body.address.trim();
  const admissionDate = req.body.admissionDate;
  const monthlyFee = Number(req.body.monthlyFee);
  const bloodGroup = (req.body.bloodGroup || "").trim();
  const rollNumber = req.body.rollNumber.trim();
  const session = resolveSession(req.body.session);
  const classId = req.body.classId;
  const sectionId = req.body.sectionId;
  const major = req.body.major;
  const group = req.body.group;

  if (digitsOnly(phone) < 10) {
    res.status(400);
    throw new Error("Enter a valid phone number with at least 10 digits");
  }

  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    res.status(400);
    throw new Error("Enter a valid monthly fee");
  }

  if (!isGroupValidForMajor(group, major)) {
    const allowed = groupsForMajor(major)
      .map((g) => ALL_GROUP_LABELS[g] || g)
      .join(", ");
    res.status(400);
    throw new Error(`Invalid group for ${MAJOR_LABELS[major] || major}. Allowed: ${allowed}`);
  }

  const schoolClass = await Class.findOne({ _id: classId, academy: academyId });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const section = await Section.findOne({
    _id: sectionId,
    academy: academyId,
    class: classId,
  });
  if (!section) {
    res.status(400);
    throw new Error("Section does not belong to this class");
  }

  let gradeLevel = null;
  if (major === "science") {
    gradeLevel = resolveScienceGrade(schoolClass, group);
  } else {
    gradeLevel = resolveClassGrade(schoolClass);
  }

  const customFields = await parseCustomFieldValues(
    academyId,
    req.body.customFields || {}
  );

  const duplicate = await Student.findOne({
    academy: academyId,
    session,
    rollNumber: new RegExp(`^${escapeRegex(rollNumber)}$`, "i"),
  });
  if (duplicate) {
    res.status(400);
    throw new Error("That roll number is already used in this session");
  }

  const nameDuplicate = await Student.findOne({
    academy: academyId,
    session,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    fatherName: new RegExp(`^${escapeRegex(fatherName)}$`, "i"),
  });
  if (nameDuplicate) {
    res.status(400);
    throw new Error("A student with the same name and father name already exists in this session");
  }

  const student = await Student.create({
    name,
    fatherName,
    phone,
    guardianPhone,
    email,
    gender,
    dateOfBirth: dateOfBirth || null,
    cnicOrBForm,
    address,
    admissionDate,
    monthlyFee,
    bloodGroup,
    rollNumber,
    session,
    academy: academyId,
    class: classId,
    section: sectionId,
    major,
    group,
    gradeLevel,
    customFields,
  });

  let enrolledSubjects = [];
  try {
    if (major === "science") {
      enrolledSubjects = await syncStudentSubjects({
        academyId,
        studentId: student._id,
        classId,
        gradeLevel,
        group,
        major,
      });
    }
  } catch (err) {
    await student.deleteOne();
    res.status(err.statusCode || 500);
    throw err;
  }

  let feeReceipt = null;
  if (req.body.collectFeeOnAdd) {
    try {
      const periodKey = req.body.feePeriodKey || currentPeriodKey();
      const selectedIds = Array.isArray(req.body.collectFeeHeadIds)
        ? req.body.collectFeeHeadIds.map(String).filter(Boolean)
        : [];
      let items = selectedIds.map((feeHeadId) => ({ feeHeadId }));
      // Backward compat: old clients sent Monthly (+ optional Admission) only.
      if (!items.length) {
        items = [{ feeHeadName: "Monthly Fee" }];
        if (req.body.collectAdmissionFee) {
          items.push({ feeHeadName: "Admission Fee" });
        }
      }
      const paidAt = req.body.feePaidAt
        ? new Date(`${req.body.feePaidAt}T12:00:00.000Z`)
        : new Date();
      feeReceipt = await recordFeeCollection({
        academyId,
        student,
        session,
        periodKey,
        method: req.body.feeMethod || "cash",
        paidAt,
        note: req.body.feeNote || "Collected on student admission",
        receivedBy: req.user._id,
        items,
      });
    } catch (err) {
      await StudentSubject.deleteMany({ student: student._id });
      await student.deleteOne();
      res.status(err.statusCode || 500);
      throw err;
    }
  }

  const populated = await Student.findById(student._id)
    .populate("class", "name")
    .populate("section", "name")
    .lean();

  const message = feeReceipt
    ? `Student added · fee collected (${feeReceipt.receiptNumber})`
    : "Student added successfully";

  res.status(201).json({
    success: true,
    message,
    student: {
      ...(await formatStudent(populated)),
      enrolledCount: enrolledSubjects.length,
    },
    feePayment: feeReceipt
      ? {
          receiptNumber: feeReceipt.receiptNumber,
          amount: feeReceipt.amount,
          periodKey: feeReceipt.periodKey,
        }
      : null,
  });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = req.body.name.trim();
  const fatherName = req.body.fatherName.trim();
  const phone = req.body.phone.trim();
  const guardianPhone = (req.body.guardianPhone || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const gender = req.body.gender;
  const dateOfBirth = req.body.dateOfBirth || null;
  const cnicOrBForm = (req.body.cnicOrBForm || "").trim();
  const address = req.body.address.trim();
  const admissionDate = req.body.admissionDate;
  const monthlyFee = Number(req.body.monthlyFee);
  const bloodGroup = (req.body.bloodGroup || "").trim();
  const rollNumber = req.body.rollNumber.trim();
  const classId = req.body.classId;
  const sectionId = req.body.sectionId;
  const major = req.body.major;
  const group = req.body.group;

  if (digitsOnly(phone) < 10) {
    res.status(400);
    throw new Error("Enter a valid phone number with at least 10 digits");
  }

  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    res.status(400);
    throw new Error("Enter a valid monthly fee");
  }

  const student = await Student.findOne({ _id: req.params.id, academy: academyId });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  const session = resolveSession(req.body.session || student.session);

  if (!isGroupValidForMajor(group, major)) {
    const allowed = groupsForMajor(major)
      .map((g) => ALL_GROUP_LABELS[g] || g)
      .join(", ");
    res.status(400);
    throw new Error(`Invalid group for ${MAJOR_LABELS[major] || major}. Allowed: ${allowed}`);
  }

  const schoolClass = await Class.findOne({ _id: classId, academy: academyId });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const section = await Section.findOne({
    _id: sectionId,
    academy: academyId,
    class: classId,
  });
  if (!section) {
    res.status(400);
    throw new Error("Section does not belong to this class");
  }

  let gradeLevel = null;
  if (major === "science") {
    gradeLevel = resolveScienceGrade(schoolClass, group);
  } else {
    gradeLevel = resolveClassGrade(schoolClass);
  }

  const customFields = await parseCustomFieldValues(
    academyId,
    req.body.customFields || {}
  );

  const duplicate = await Student.findOne({
    _id: { $ne: student._id },
    academy: academyId,
    session,
    rollNumber: new RegExp(`^${escapeRegex(rollNumber)}$`, "i"),
  });
  if (duplicate) {
    res.status(400);
    throw new Error("That roll number is already used in this session");
  }

  const nameDuplicate = await Student.findOne({
    _id: { $ne: student._id },
    academy: academyId,
    session,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    fatherName: new RegExp(`^${escapeRegex(fatherName)}$`, "i"),
  });
  if (nameDuplicate) {
    res.status(400);
    throw new Error("A student with the same name and father name already exists in this session");
  }

  const packageChanged =
    String(student.class) !== String(classId) ||
    student.group !== group ||
    student.major !== major ||
    Number(student.gradeLevel || 0) !== Number(gradeLevel || 0);

  student.name = name;
  student.fatherName = fatherName;
  student.phone = phone;
  student.guardianPhone = guardianPhone;
  student.email = email;
  student.gender = gender;
  student.dateOfBirth = dateOfBirth || null;
  student.cnicOrBForm = cnicOrBForm;
  student.address = address;
  student.admissionDate = admissionDate;
  student.monthlyFee = monthlyFee;
  student.bloodGroup = bloodGroup;
  student.rollNumber = rollNumber;
  student.session = session;
  student.class = classId;
  student.section = sectionId;
  student.major = major;
  student.group = group;
  student.gradeLevel = gradeLevel;
  student.customFields = customFields;
  if (typeof req.body.isActive === "boolean") {
    student.isActive = req.body.isActive;
  }

  await student.save();

  if (packageChanged) {
    await syncStudentSubjects({
      academyId,
      studentId: student._id,
      classId,
      gradeLevel,
      group,
      major,
    });
  }

  const populated = await Student.findById(student._id)
    .populate("class", "name")
    .populate("section", "name")
    .lean();

  res.json({
    success: true,
    message: "Student updated successfully",
    student: await formatStudent(populated),
  });
});

export const toggleStudentActive = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const student = await Student.findOne({ _id: req.params.id, academy: academyId });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  student.isActive = !student.isActive;
  await student.save();

  res.json({
    success: true,
    message: student.isActive ? "Student activated" : "Student deactivated",
    active: student.isActive,
  });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const student = await Student.findOne({ _id: req.params.id, academy: academyId });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  if (student.isActive) {
    res.status(400);
    throw new Error("Deactivate the student before deleting");
  }

  await StudentSubject.deleteMany({ student: student._id });
  await student.deleteOne();

  res.json({
    success: true,
    message: "Student deleted successfully",
  });
});

export const promoteStudent = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const session = resolveSession(req.body.session);
  const classId = req.body.classId;
  const sectionId = req.body.sectionId;
  const group = req.body.group;
  const rollNumber = String(req.body.rollNumber || "").trim();
  const monthlyFee =
    req.body.monthlyFee != null ? Number(req.body.monthlyFee) : undefined;

  const source = await Student.findOne({
    _id: req.params.id,
    academy: academyId,
  }).populate("class", "name gradeLevel");

  if (!source) {
    res.status(404);
    throw new Error("Student not found");
  }

  if (!source.isActive) {
    res.status(400);
    throw new Error("Activate the student before promoting");
  }

  const currentGrade = resolveClassGrade(source.class) || Number(source.gradeLevel);
  if (!currentGrade) {
    res.status(400);
    throw new Error("Current class needs a grade before promotion");
  }
  if (currentGrade >= 12) {
    res.status(400);
    throw new Error("Class 12 students cannot be promoted further");
  }

  const expectedSession = nextSessionLabel(source.session);
  if (session !== expectedSession) {
    res.status(400);
    throw new Error(
      `Promote into the next session only (${expectedSession}). Current session is ${source.session}.`
    );
  }

  const schoolClass = await Class.findOne({ _id: classId, academy: academyId });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const nextGrade = resolveClassGrade(schoolClass);
  if (nextGrade !== currentGrade + 1) {
    res.status(400);
    throw new Error(
      `Next class must be grade ${currentGrade + 1} (got ${schoolClass.name})`
    );
  }

  const section = await Section.findOne({
    _id: sectionId,
    academy: academyId,
    class: classId,
  });
  if (!section) {
    res.status(400);
    throw new Error("Section does not belong to this class");
  }

  const major = source.major;
  if (!isGroupValidForMajor(group, major)) {
    const allowed = groupsForMajor(major)
      .map((g) => ALL_GROUP_LABELS[g] || g)
      .join(", ");
    res.status(400);
    throw new Error(`Invalid group for ${MAJOR_LABELS[major] || major}. Allowed: ${allowed}`);
  }

  let gradeLevel = null;
  if (major === "science") {
    gradeLevel = resolveScienceGrade(schoolClass, group);
  } else {
    gradeLevel = nextGrade;
  }

  const already = await Student.findOne({
    academy: academyId,
    session,
    name: new RegExp(`^${escapeRegex(source.name)}$`, "i"),
    fatherName: new RegExp(`^${escapeRegex(source.fatherName)}$`, "i"),
  });
  if (already) {
    res.status(400);
    throw new Error("This student is already enrolled in that session");
  }

  const rollTaken = await Student.findOne({
    academy: academyId,
    session,
    rollNumber: new RegExp(`^${escapeRegex(rollNumber)}$`, "i"),
  });
  if (rollTaken) {
    res.status(400);
    throw new Error("That roll number is already used in this session");
  }

  const promoted = await Student.create({
    name: source.name,
    fatherName: source.fatherName,
    phone: source.phone,
    guardianPhone: source.guardianPhone,
    email: source.email,
    gender: source.gender,
    dateOfBirth: source.dateOfBirth,
    cnicOrBForm: source.cnicOrBForm,
    address: source.address,
    admissionDate: source.admissionDate,
    monthlyFee: Number.isFinite(monthlyFee) ? monthlyFee : source.monthlyFee,
    bloodGroup: source.bloodGroup,
    rollNumber,
    session,
    academy: academyId,
    class: classId,
    section: sectionId,
    major,
    group,
    gradeLevel,
    customFields: mapToObject(source.customFields),
    isActive: true,
  });

  let enrolledSubjects = [];
  try {
    if (major === "science") {
      enrolledSubjects = await syncStudentSubjects({
        academyId,
        studentId: promoted._id,
        classId,
        gradeLevel,
        group,
        major,
      });
    }
  } catch (err) {
    await promoted.deleteOne();
    res.status(err.statusCode || 500);
    throw err;
  }

  const populated = await Student.findById(promoted._id)
    .populate("class", "name")
    .populate("section", "name")
    .lean();

  res.status(201).json({
    success: true,
    message: `Promoted to ${schoolClass.name} · ${session}`,
    suggestedGroup: suggestedGroup(source.group, nextGrade, major),
    student: {
      ...(await formatStudent(populated)),
      enrolledCount: enrolledSubjects.length,
    },
  });
});
