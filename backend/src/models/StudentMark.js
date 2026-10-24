import mongoose from "mongoose";

const studentMarkSchema = new mongoose.Schema(
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
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
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

studentMarkSchema.index({ assessment: 1, student: 1 }, { unique: true });

export default mongoose.model("StudentMark", studentMarkSchema);
