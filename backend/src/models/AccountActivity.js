import mongoose from "mongoose";

export const ACTIVITY_ACTIONS = [
  "LOGIN",
  "PAPER_CREATE",
  "PAPER_UPDATE",
  "PAPER_DELETE",
  "PAPER_PRINT",
  "TEACHER_CREATE",
  "TEACHER_UPDATE",
  "TEACHER_DELETE",
  "SUB_ACCOUNT_CREATE",
  "SUB_ACCOUNT_UPDATE",
  "SUB_ACCOUNT_DELETE",
];

const accountActivitySchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorName: {
      type: String,
      trim: true,
      default: "",
    },
    actorEmail: {
      type: String,
      trim: true,
      default: "",
    },
    actorRole: {
      type: String,
      trim: true,
      default: "",
    },
    action: {
      type: String,
      enum: ACTIVITY_ACTIONS,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

accountActivitySchema.index({ academy: 1, createdAt: -1 });

export default mongoose.model("AccountActivity", accountActivitySchema);
