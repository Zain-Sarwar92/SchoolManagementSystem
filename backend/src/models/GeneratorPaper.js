import mongoose from "mongoose";

const paperQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenQuestion",
      default: null,
    },
    type: { type: String, enum: ["MCQ", "SHORT", "LONG"], required: true },
    text: { type: String, required: true },
    textUrdu: { type: String, default: null },
    optionA: { type: String, default: null },
    optionB: { type: String, default: null },
    optionC: { type: String, default: null },
    optionD: { type: String, default: null },
    correctAnswer: { type: String, default: null },
    marks: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const paperSectionSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, default: null },
    type: { type: String, enum: ["MCQ", "SHORT", "LONG"], required: true },
    subType: { type: String, trim: true, default: null },
    order: { type: Number, default: 0 },
    attemptCount: { type: Number, default: 0 },
    marksEach: { type: Number, default: 1 },
    questions: { type: [paperQuestionSchema], default: [] },
  },
  { _id: false }
);

/**
 * Standalone Test Generator papers (isolated from Academy Management).
 */
const generatorPaperSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    boardLabel: {
      type: String,
      trim: true,
      default: "PTB",
      maxlength: 80,
    },
    classLabel: { type: String, required: true, trim: true, maxlength: 80 },
    subjectLabel: { type: String, required: true, trim: true, maxlength: 80 },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenSubject",
      default: null,
    },
    medium: {
      type: String,
      enum: ["english", "urdu", "dual"],
      default: "english",
    },
    distributionMode: {
      type: String,
      enum: ["BALANCED", "RANDOM"],
      default: "BALANCED",
    },
    totalMarks: { type: Number, default: 0, min: 0 },
    durationMinutes: { type: Number, default: 60, min: 1 },
    examDate: { type: Date, default: null },
    instructions: { type: String, trim: true, default: "", maxlength: 2000 },
    syllabusNote: { type: String, trim: true, default: "", maxlength: 4000 },
    paperCategory: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    sections: { type: [paperSectionSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "saved"],
      default: "saved",
    },
  },
  { timestamps: true }
);

generatorPaperSchema.index({ academy: 1, createdAt: -1 });

export default mongoose.model("GeneratorPaper", generatorPaperSchema);
