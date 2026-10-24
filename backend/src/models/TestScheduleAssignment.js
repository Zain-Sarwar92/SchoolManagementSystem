import mongoose from "mongoose";

const testScheduleAssignmentSchema = new mongoose.Schema(
  {
    scheduleSubjectClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestScheduleSubjectClass",
      required: true,
      index: true,
    },
    /** Optional — schedules can be date/section plans without teachers. */
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
      index: true,
    },
    sectionName: {
      type: String,
      trim: true,
      default: "",
    },
    syllabusText: {
      type: String,
      trim: true,
      default: "",
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    coveredByTest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestPaper",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One row per section under a class×subject (teacher optional)
testScheduleAssignmentSchema.index(
  { scheduleSubjectClass: 1, sectionName: 1 },
  { unique: true }
);

export default mongoose.model(
  "TestScheduleAssignment",
  testScheduleAssignmentSchema
);
