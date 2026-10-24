import mongoose from "mongoose";

const testScheduleRoundSchema = new mongoose.Schema(
  {
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestSchedule",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TestScheduleRound", testScheduleRoundSchema);
