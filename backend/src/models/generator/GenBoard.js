import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    /** Short code e.g. PTB, AFAQ */
    code: { type: String, trim: true, default: "" },
    /** Card subtitle — PTS uses "Syllabus" */
    subtitle: { type: String, trim: true, default: "Syllabus" },
    /** PTS CourseID (1=PTB, 2=AFAQ, …) */
    ptsCourseId: { type: Number, default: null, index: true },
    imageUrl: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export default mongoose.model("GenBoard", schema);
