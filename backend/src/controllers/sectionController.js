import Class from "../models/Class.js";
import Section from "../models/Section.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const splitSectionNames = (raw = "") => [
  ...new Set(
    raw
      .split(/[,/|]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  ),
];

export const getSections = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const filter = { academy: academyId };

  if (req.query.classId) {
    filter.class = req.query.classId;
  }

  const sections = await Section.find(filter)
    .populate("class", "name isActive")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: sections.length,
    sections,
  });
});

export const createSection = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { name, classId, capacity, description } = req.body;

  const schoolClass = await Class.findOne({
    _id: classId,
    academy: academyId,
    isActive: true,
  });

  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found. Create the class first in Classes module.");
  }

  const names = splitSectionNames(name);
  if (names.length === 0) {
    res.status(400);
    throw new Error("Enter at least one section name");
  }

  for (const sectionName of names) {
    if (sectionName.length > 40) {
      res.status(400);
      throw new Error(`Section name is too long: ${sectionName}`);
    }
  }

  const existing = await Section.find({
    academy: academyId,
    class: schoolClass._id,
  }).select("name");

  const existingLower = new Set(existing.map((item) => item.name.toLowerCase()));
  const conflicts = names.filter((item) => existingLower.has(item.toLowerCase()));

  if (conflicts.length > 0) {
    res.status(400);
    throw new Error(`Already exists for this class: ${conflicts.join(", ")}`);
  }

  const created = await Section.insertMany(
    names.map((sectionName) => ({
      name: sectionName,
      class: schoolClass._id,
      academy: academyId,
      capacity: capacity || null,
      description: description || "",
    }))
  );

  const sections = await Section.find({
    _id: { $in: created.map((item) => item._id) },
  }).populate("class", "name");

  res.status(201).json({
    success: true,
    message:
      names.length > 1
        ? `${names.length} sections created successfully`
        : "Section created successfully",
    count: sections.length,
    sections,
  });
});

export const updateSection = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const { name, classId, capacity, description, isActive } = req.body;

  const section = await Section.findOne({ _id: req.params.id, academy: academyId });
  if (!section) {
    res.status(404);
    throw new Error("Section not found");
  }

  const names = splitSectionNames(name);
  if (names.length !== 1) {
    res.status(400);
    throw new Error("Edit one section at a time");
  }

  const sectionName = names[0];

  const schoolClass = await Class.findOne({
    _id: classId,
    academy: academyId,
  });
  if (!schoolClass) {
    res.status(404);
    throw new Error("Class not found");
  }

  const duplicate = await Section.findOne({
    _id: { $ne: section._id },
    academy: academyId,
    class: schoolClass._id,
    name: new RegExp(`^${escapeRegex(sectionName)}$`, "i"),
  });

  if (duplicate) {
    res.status(400);
    throw new Error("This section already exists for the selected class");
  }

  section.name = sectionName;
  section.class = schoolClass._id;
  section.capacity = capacity || null;
  section.description = description || "";
  if (typeof isActive === "boolean") section.isActive = isActive;

  await section.save();
  await section.populate("class", "name");

  res.json({
    success: true,
    message: "Section updated successfully",
    section,
  });
});

export const deleteSection = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);

  const section = await Section.findOneAndDelete({
    _id: req.params.id,
    academy: academyId,
  });

  if (!section) {
    res.status(404);
    throw new Error("Section not found");
  }

  res.json({
    success: true,
    message: "Section deleted successfully",
  });
});
