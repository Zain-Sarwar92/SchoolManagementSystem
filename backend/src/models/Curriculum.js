import mongoose from "mongoose";
import { SCIENCE_GROUPS, SCIENCE_GRADES } from "../constants/scienceCurriculum.js";

/** Global Science Major package: grade + group → ordered subjects */
const curriculumSchema = new mongoose.Schema(
  {
    stream: {
      type: String,
      enum: ["science"],
      default: "science",
    },
    gradeLevel: {
      type: Number,
      required: true,
      enum: SCIENCE_GRADES,
    },
    group: {
      type: String,
      required: true,
      enum: SCIENCE_GROUPS,
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

curriculumSchema.index(
  { stream: 1, gradeLevel: 1, group: 1 },
  { unique: true }
);

export default mongoose.model("Curriculum", curriculumSchema);
