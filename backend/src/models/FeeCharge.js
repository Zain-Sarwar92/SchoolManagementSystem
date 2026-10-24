import mongoose from "mongoose";

const feeChargeSchema = new mongoose.Schema(
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
    feeHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeHead",
      required: true,
    },
    session: {
      type: String,
      required: true,
      trim: true,
    },
    /** YYYY-MM for monthly, ONCE for one-time */
    periodKey: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "waived"],
      default: "unpaid",
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

feeChargeSchema.index({ student: 1, feeHead: 1, periodKey: 1 }, { unique: true });
feeChargeSchema.index({ academy: 1, session: 1, periodKey: 1, status: 1 });

export default mongoose.model("FeeCharge", feeChargeSchema);
