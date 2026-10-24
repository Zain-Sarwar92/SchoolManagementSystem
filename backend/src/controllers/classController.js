import Class from "../models/Class.js";
import Section from "../models/Section.js";
import { inferGradeFromClassName } from "../constants/majors.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import mongoose from "mongoose";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getClasses = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const includeInactive = req.query.includeInactive === "true";

  const filter = { academy: academyId };
  if (!includeInactive) filter.isActive = true;

  const classes = await Class.find(filter).sort({ name: 1 }).lean();

  const academyObjectId = mongoose.Types.ObjectId.isValid(academyId)
    ? new mongoose.Types.ObjectId(academyId)
    : academyId;

  const counts =
    classes.length === 0
      ? []
      : await Section.aggregate([
          {
            $match: {
              academy: academyObjectId,
              class: { $in: classes.map((c) => c._id) },
            },
          },
          { $group: { _id: "$class", count: { $sum: 1 } } },
        ]);

  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

  const withCounts = classes.map((schoolClass) => ({
    ...schoolClass,
    sectionCount: countMap.get(String(schoolClass._id)) || 0,
  }));

  res.json({
    success: true,
    count: withCounts.length,
    classes: withCounts,
  });
});

export const createClass = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = req.body.name.trim();
  const description = (req.body.description || "").trim();
  // Grade is not collected in UI — auto from class name (e.g. "Class 9" → 9)
  const gradeLevel = inferGradeFromClassName(name);

  const existing = await Class.findOne({
    academy: academyId,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
  });

  if (existing) {
    res.status(400);
    throw new Error("Class already exists");
  }

  const schoolClass = await Class.create({
    name,
    description,
    gradeLevel,
    academy: academyId,
  });

  res.status(201).json({
    success: true,
    message: "Class created successfully",
    class: { ...schoolClass.toObject(), sectionCount: 0 },
  });
});

export const updateClass = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const name = req.body.name.trim();
  const description = (req.body.description || "").trim();

  const schoolClass = await Class.findOne({ _id: req.params.id, academy: academyId });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const duplicate = await Class.findOne({
    _id: { $ne: schoolClass._id },
    academy: academyId,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
  });

  if (duplicate) {
    res.status(400);
    throw new Error("Class already exists");
  }

  schoolClass.name = name;
  schoolClass.description = description;
  schoolClass.gradeLevel = inferGradeFromClassName(name);
  if (typeof req.body.isActive === "boolean") {
    schoolClass.isActive = req.body.isActive;
  }

  await schoolClass.save();

  const sectionCount = await Section.countDocuments({
    academy: academyId,
    class: schoolClass._id,
  });

  res.json({
    success: true,
    message: "Class updated successfully",
    class: { ...schoolClass.toObject(), sectionCount },
  });
});

export const deleteClass = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);

  const schoolClass = await Class.findOne({ _id: req.params.id, academy: academyId });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const sectionCount = await Section.countDocuments({
    academy: academyId,
    class: schoolClass._id,
  });

  if (sectionCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete class while ${sectionCount} section(s) exist. Delete sections first.`
    );
  }

  await schoolClass.deleteOne();

  res.json({
    success: true,
    message: "Class deleted successfully",
  });
});
