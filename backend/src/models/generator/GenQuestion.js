import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenTopic",
      required: true,
      index: true,
    },
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenChapter",
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenSubject",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["MCQ", "SHORT", "LONG"],
      required: true,
      index: true,
    },
    subType: { type: String, trim: true, default: null, index: true },
    text: { type: String, required: true },
    textUrdu: { type: String, default: null },
    optionA: { type: String, default: null },
    optionB: { type: String, default: null },
    optionC: { type: String, default: null },
    optionD: { type: String, default: null },
    correctAnswer: { type: String, default: null },
    marks: { type: Number, default: 1, min: 0 },
    source: { type: String, default: null },
    externalKey: { type: String, unique: true, sparse: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

schema.index({ subject: 1, type: 1, isActive: 1 });
schema.index({ chapter: 1, type: 1 });
schema.index({ topic: 1, type: 1 });

export default mongoose.model("GenQuestion", schema);
