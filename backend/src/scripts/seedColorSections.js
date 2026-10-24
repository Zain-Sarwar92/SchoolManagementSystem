/**
 * Ensure every class has color-named sections: Red, Blue, Green, Yellow.
 * Usage: node src/scripts/seedColorSections.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";

dotenv.config();

const COLORS = ["Red", "Blue", "Green", "Yellow"];

const seedColorSections = async () => {
  try {
    await connectDB();

    const classes = await Class.find({});
    let created = 0;
    let skipped = 0;

    for (const schoolClass of classes) {
      const existing = await Section.find({
        academy: schoolClass.academy,
        class: schoolClass._id,
      }).select("name");

      const existingLower = new Set(
        existing.map((item) => item.name.toLowerCase())
      );

      for (const color of COLORS) {
        if (existingLower.has(color.toLowerCase())) {
          skipped += 1;
          continue;
        }

        await Section.create({
          name: color,
          class: schoolClass._id,
          academy: schoolClass.academy,
          isActive: true,
        });

        created += 1;
        console.log(`+ ${schoolClass.name} → ${color}`);
      }
    }

    console.log(`Done. Created ${created}, skipped ${skipped} existing.`);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedColorSections();
