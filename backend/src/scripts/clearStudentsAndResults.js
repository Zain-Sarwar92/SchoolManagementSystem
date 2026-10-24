/**
 * Delete ALL students and ALL result data (exams, assessments, marks).
 * Keeps classes, sections, subjects, academies, fee heads.
 *
 * Usage: node src/scripts/clearStudentsAndResults.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Student from "../models/Student.js";
import StudentSubject from "../models/StudentSubject.js";
import StudentMark from "../models/StudentMark.js";
import AssessmentManualMark from "../models/AssessmentManualMark.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import ExamTerm from "../models/ExamTerm.js";
import FeeCharge from "../models/FeeCharge.js";
import FeePayment from "../models/FeePayment.js";
import FeePaymentAllocation from "../models/FeePaymentAllocation.js";

dotenv.config();

const run = async () => {
  try {
    await connectDB();

    const [
      alloc,
      payments,
      charges,
      marks,
      manuals,
      enrollments,
      assessments,
      exams,
      students,
    ] = await Promise.all([
      FeePaymentAllocation.deleteMany({}),
      FeePayment.deleteMany({}),
      FeeCharge.deleteMany({}),
      StudentMark.deleteMany({}),
      AssessmentManualMark.deleteMany({}),
      StudentSubject.deleteMany({}),
      SubjectAssessment.deleteMany({}),
      ExamTerm.deleteMany({}),
      Student.deleteMany({}),
    ]);

    console.log("Deleted:");
    console.log(`  students:           ${students.deletedCount}`);
    console.log(`  student subjects:   ${enrollments.deletedCount}`);
    console.log(`  student marks:      ${marks.deletedCount}`);
    console.log(`  manual marks:       ${manuals.deletedCount}`);
    console.log(`  subject assessments:${assessments.deletedCount}`);
    console.log(`  exams:              ${exams.deletedCount}`);
    console.log(`  fee charges:        ${charges.deletedCount}`);
    console.log(`  fee payments:       ${payments.deletedCount}`);
    console.log(`  fee allocations:    ${alloc.deletedCount}`);
    console.log("\nDone. Classes/sections/subjects kept.");
  } catch (error) {
    console.error("Failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
