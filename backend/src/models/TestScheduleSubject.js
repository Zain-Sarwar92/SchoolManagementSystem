import mongoose from "mongoose";

const testScheduleSubjectSchema = new mongoose.Schema(
  {
    round: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestScheduleRound",
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    testDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

testScheduleSubjectSchema.index(
  { round: 1, subjectName: 1, testDate: 1 },
  { unique: true }
);

export default mongoose.model("TestScheduleSubject", testScheduleSubjectSchema);
