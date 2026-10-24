import CustomField, { CUSTOM_FIELD_TYPES } from "../models/CustomField.js";
import { asyncHandler, getAcademyId } from "../utils/helpers.js";

const slugifyKey = (label) =>
  String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || `field_${Date.now()}`;

export const listCustomFields = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const module = req.query.module || "student";

  const fields = await CustomField.find({
    academy: academyId,
    module,
    isActive: true,
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  res.json({
    success: true,
    fieldTypes: CUSTOM_FIELD_TYPES,
    fields,
  });
});

export const createCustomField = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const label = (req.body.label || "").trim();
  const type = req.body.type;
  const module = req.body.module || "student";

  if (!label) {
    res.status(400);
    throw new Error("Field label is required");
  }

  if (!CUSTOM_FIELD_TYPES.includes(type)) {
    res.status(400);
    throw new Error("Unsupported field type");
  }

  let key = (req.body.key || "").trim() || slugifyKey(label);
  key = slugifyKey(key);

  const options = Array.isArray(req.body.options)
    ? req.body.options.map((o) => String(o).trim()).filter(Boolean)
    : String(req.body.optionsText || "")
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean);

  if (["select", "radio"].includes(type) && options.length === 0) {
    res.status(400);
    throw new Error("Add at least one option for select/radio fields");
  }

  const existing = await CustomField.findOne({ academy: academyId, module, key });
  if (existing) {
    res.status(400);
    throw new Error("A field with this key already exists");
  }

  const count = await CustomField.countDocuments({ academy: academyId, module });

  const field = await CustomField.create({
    academy: academyId,
    module,
    label,
    key,
    type,
    options,
    required: Boolean(req.body.required),
    placeholder: (req.body.placeholder || "").trim(),
    min: req.body.min === "" || req.body.min == null ? null : Number(req.body.min),
    max: req.body.max === "" || req.body.max == null ? null : Number(req.body.max),
    order: count,
  });

  res.status(201).json({
    success: true,
    message: "Custom field added",
    field,
  });
});

export const updateCustomField = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const field = await CustomField.findOne({
    _id: req.params.id,
    academy: academyId,
  });

  if (!field) {
    res.status(404);
    throw new Error("Custom field not found");
  }

  if (req.body.label != null) field.label = String(req.body.label).trim();
  if (req.body.type && CUSTOM_FIELD_TYPES.includes(req.body.type)) {
    field.type = req.body.type;
  }
  if (typeof req.body.required === "boolean") field.required = req.body.required;
  if (req.body.placeholder != null) {
    field.placeholder = String(req.body.placeholder).trim();
  }
  if (req.body.options != null || req.body.optionsText != null) {
    field.options = Array.isArray(req.body.options)
      ? req.body.options.map((o) => String(o).trim()).filter(Boolean)
      : String(req.body.optionsText || "")
          .split(/[\n,]/)
          .map((o) => o.trim())
          .filter(Boolean);
  }
  if (req.body.min !== undefined) {
    field.min = req.body.min === "" || req.body.min == null ? null : Number(req.body.min);
  }
  if (req.body.max !== undefined) {
    field.max = req.body.max === "" || req.body.max == null ? null : Number(req.body.max);
  }
  if (typeof req.body.isActive === "boolean") field.isActive = req.body.isActive;

  await field.save();

  res.json({ success: true, message: "Custom field updated", field });
});

export const deleteCustomField = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const field = await CustomField.findOne({
    _id: req.params.id,
    academy: academyId,
  });

  if (!field) {
    res.status(404);
    throw new Error("Custom field not found");
  }

  await field.deleteOne();

  res.json({ success: true, message: "Custom field removed" });
});

export const uploadCustomFieldFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Choose a file to upload");
  }

  const url = `/uploads/student-files/${req.file.filename}`;
  res.status(201).json({
    success: true,
    message: "File uploaded",
    url,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});
