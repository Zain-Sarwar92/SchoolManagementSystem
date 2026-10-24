import mongoose from "mongoose";

const subjectAssessmentSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    examTerm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamTerm",
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    /** Snapshot so gazette still labels correctly if subject is renamed later. */
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    totalMarks: {
      type: Number,
      default: 30,
      min: 0.01,
      max: 1000,
    },
  },
  { timestamps: true }
);

subjectAssessmentSchema.index(
  { examTerm: 1, section: 1, subject: 1 },
  { unique: true }
);

export default mongoose.model("SubjectAssessment", subjectAssessmentSchema);
