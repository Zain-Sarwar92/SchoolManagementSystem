import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenChapter",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    code: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

schema.index({ chapter: 1, name: 1 }, { unique: true });

export default mongoose.model("GenTopic", schema);
