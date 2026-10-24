import mongoose from "mongoose";

const testScheduleSubjectClassSchema = new mongoose.Schema(
  {
    scheduleSubject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestScheduleSubject",
      required: true,
      index: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

testScheduleSubjectClassSchema.index(
  { scheduleSubject: 1, class: 1 },
  { unique: true }
);

export default mongoose.model(
  "TestScheduleSubjectClass",
  testScheduleSubjectClassSchema
);
