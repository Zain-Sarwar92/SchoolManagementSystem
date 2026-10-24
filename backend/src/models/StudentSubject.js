import mongoose from "mongoose";
import { ALL_GROUPS } from "../constants/majors.js";

const studentSubjectSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    group: {
      type: String,
      required: true,
      enum: ALL_GROUPS,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
  },
  { timestamps: true }
);

studentSubjectSchema.index({ student: 1, subject: 1 }, { unique: true });

export default mongoose.model("StudentSubject", studentSubjectSchema);
