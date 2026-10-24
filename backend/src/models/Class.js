import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /** Numeric grade 1–12 — drives Science groups for student enrollment */
    gradeLevel: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

classSchema.index({ academy: 1, name: 1 }, { unique: true });

export default mongoose.model("Class", classSchema);
