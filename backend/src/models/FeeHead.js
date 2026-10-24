import mongoose from "mongoose";

const feeHeadSchema = new mongoose.Schema(
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
      maxlength: 100,
    },
    category: {
      type: String,
      enum: ["tuition", "admission", "generator", "test", "lab", "transport", "other"],
      default: "tuition",
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    defaultAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    frequency: {
      type: String,
      enum: ["monthly", "one_time"],
      default: "monthly",
    },
    /** Empty = every month. Otherwise calendar months 1–12. */
    applicableMonths: {
      type: [Number],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

feeHeadSchema.index({ academy: 1, name: 1 }, { unique: true });

export default mongoose.model("FeeHead", feeHeadSchema);
