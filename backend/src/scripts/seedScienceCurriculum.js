/**
 * Seed global Science Major subject packages (Class 9–12 × groups).
 * Usage: node src/scripts/seedScienceCurriculum.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Subject from "../models/Subject.js";
import Curriculum from "../models/Curriculum.js";
import { SCIENCE_CURRICULUM_PACKAGES } from "../constants/scienceCurriculum.js";

dotenv.config();

const seedScienceCurriculum = async () => {
  try {
    await connectDB();

    const nameSet = new Set();
    for (const pkg of SCIENCE_CURRICULUM_PACKAGES) {
      for (const name of pkg.subjects) nameSet.add(name);
    }

    const subjectByName = new Map();

    for (const name of nameSet) {
      const subject = await Subject.findOneAndUpdate(
        { name },
        {
          $setOnInsert: {
            name,
            stream: "science",
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );
      subjectByName.set(name, subject._id);
      console.log(`Subject: ${name}`);
    }

    for (const pkg of SCIENCE_CURRICULUM_PACKAGES) {
      const subjectIds = pkg.subjects.map((name) => subjectByName.get(name));

      await Curriculum.findOneAndUpdate(
        {
          stream: "science",
          gradeLevel: pkg.gradeLevel,
          group: pkg.group,
        },
        {
          stream: "science",
          gradeLevel: pkg.gradeLevel,
          group: pkg.group,
          subjects: subjectIds,
        },
        { upsert: true, new: true }
      );

      console.log(
        `Curriculum: Grade ${pkg.gradeLevel} / ${pkg.group} (${pkg.subjects.length} subjects)`
      );
    }

    console.log("Science curriculum seeded successfully.");
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedScienceCurriculum();
