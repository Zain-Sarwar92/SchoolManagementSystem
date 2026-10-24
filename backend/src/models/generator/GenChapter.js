import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenSubject",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ subject: 1, name: 1 }, { unique: true });

export default mongoose.model("GenChapter", schema);
