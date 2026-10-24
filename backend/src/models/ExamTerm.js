import mongoose from "mongoose";

const examTermSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    session: {
      type: String,
      required: true,
      trim: true,
    },
    passPercent: {
      type: Number,
      default: 33,
      min: 1,
      max: 100,
    },
    examDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

examTermSchema.index({ academy: 1, name: 1, session: 1 }, { unique: true });

export default mongoose.model("ExamTerm", examTermSchema);
