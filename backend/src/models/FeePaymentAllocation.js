import mongoose from "mongoose";

const feePaymentAllocationSchema = new mongoose.Schema(
  {
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeePayment",
      required: true,
      index: true,
    },
    charge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeCharge",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { timestamps: true }
);

feePaymentAllocationSchema.index({ payment: 1, charge: 1 }, { unique: true });

export default mongoose.model("FeePaymentAllocation", feePaymentAllocationSchema);
