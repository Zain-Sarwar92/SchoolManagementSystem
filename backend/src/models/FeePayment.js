import mongoose from "mongoose";

const feePaymentSchema = new mongoose.Schema(
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
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "other"],
      default: "cash",
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

feePaymentSchema.index({ academy: 1, receiptNumber: 1 }, { unique: true });
feePaymentSchema.index({ academy: 1, paidAt: -1 });

export default mongoose.model("FeePayment", feePaymentSchema);
