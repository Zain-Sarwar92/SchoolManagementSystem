import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenBoard",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    /** 1–12 for school grades; null for BA / OLD BOOKS */
    gradeLevel: { type: Number, min: 1, max: 12, default: null },
    /** PTS ClassID */
    ptsClassId: { type: Number, default: null, index: true },
  },
  { timestamps: true }
);

schema.index({ board: 1, name: 1 }, { unique: true });

export default mongoose.model("GenClass", schema);
