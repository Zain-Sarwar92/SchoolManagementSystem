import mongoose from "mongoose";

/** Marks for students not on the section roster (section change, late join, etc.). */
const assessmentManualMarkSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubjectAssessment",
      required: true,
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    fatherName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    obtainedMarks: {
      type: Number,
      default: null,
    },
    isAbsent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

assessmentManualMarkSchema.index(
  { assessment: 1, rollNumber: 1 },
  { unique: true }
);

export default mongoose.model("AssessmentManualMark", assessmentManualMarkSchema);
