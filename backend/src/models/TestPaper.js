import mongoose from "mongoose";

/** Lightweight paper linked to a schedule assignment (full question bank later). */
const testPaperSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },
    examDate: {
      type: Date,
      default: null,
    },
    classSection: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    syllabusNote: {
      type: String,
      trim: true,
      default: "",
    },
    scheduleAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestScheduleAssignment",
      default: null,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TestPaper", testPaperSchema);
