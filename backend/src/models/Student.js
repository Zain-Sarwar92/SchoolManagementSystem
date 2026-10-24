import mongoose from "mongoose";
import { ALL_GROUPS } from "../constants/majors.js";
import { currentAcademicSession } from "../utils/academicSession.js";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    cnicOrBForm: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    admissionDate: {
      type: Date,
      required: true,
    },
    monthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },
    bloodGroup: {
      type: String,
      trim: true,
      default: "",
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    /** Academic year, e.g. "2025-2026" */
    session: {
      type: String,
      required: true,
      trim: true,
      default: () => currentAcademicSession(),
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    major: {
      type: String,
      enum: ["science", "arts"],
      required: true,
    },
    group: {
      type: String,
      required: true,
      enum: ALL_GROUPS,
    },
    gradeLevel: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

studentSchema.index({ academy: 1, session: 1, rollNumber: 1 }, { unique: true });
studentSchema.index(
  { academy: 1, session: 1, name: 1, fatherName: 1 },
  { unique: true }
);

export default mongoose.model("Student", studentSchema);
