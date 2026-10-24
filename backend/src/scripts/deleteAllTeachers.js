import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import TestScheduleAssignment from "../models/TestScheduleAssignment.js";
import TestPaper from "../models/TestPaper.js";

await mongoose.connect(process.env.MONGO_URI);

const teachers = await User.find({ role: "teacher" }).select("_id").lean();
const ids = teachers.map((t) => t._id);
console.log("Teachers to delete:", teachers.length);

const a1 = await TeacherAssignment.deleteMany({ teacher: { $in: ids } });
const a2 = await TestPaper.deleteMany({ teacher: { $in: ids } });
const a3 = await TestScheduleAssignment.updateMany(
  { teacher: { $in: ids } },
  { $set: { teacher: null, completedAt: null } }
);
const a4 = await User.deleteMany({ role: "teacher" });

console.log({
  teacherAssignmentsRemoved: a1.deletedCount,
  papersRemoved: a2.deletedCount,
  scheduleAssignmentsCleared: a3.modifiedCount,
  teachersDeleted: a4.deletedCount,
});
console.log("teachers left:", await User.countDocuments({ role: "teacher" }));

await mongoose.disconnect();
