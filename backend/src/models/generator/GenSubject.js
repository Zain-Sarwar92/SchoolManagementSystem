import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GenClass",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    /** PTS subject card logo URL */
    imageUrl: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

schema.index({ class: 1, name: 1 }, { unique: true });
schema.index({ class: 1, slug: 1 }, { unique: true });

export default mongoose.model("GenSubject", schema);
