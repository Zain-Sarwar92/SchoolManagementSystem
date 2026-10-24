import mongoose from "mongoose";

/** Global subject master (unique by name). Used by Science curriculum packages. */
const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
    },
    stream: {
      type: String,
      enum: ["science"],
      default: "science",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Subject", subjectSchema);
