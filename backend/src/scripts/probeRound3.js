import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Academy from "../models/Academy.js";
import Class from "../models/Class.js";
import ExamTerm from "../models/ExamTerm.js";
import SubjectAssessment from "../models/SubjectAssessment.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";

dotenv.config();

const run = async () => {
  await connectDB();
  for (const a of await Academy.find({}).sort({ name: 1 })) {
    const exams = await ExamTerm.find({
      academy: a._id,
      name: /round\s*3/i,
    }).lean();
    console.log(`\n${a.name}`);
    if (!exams.length) {
      console.log("  no Round 3");
      continue;
    }
    for (const e of exams) {
      const assess = await SubjectAssessment.find({ examTerm: e._id }).lean();
      const secIds = [...new Set(assess.map((x) => String(x.section)))];
      const sections = await Section.find({ _id: { $in: secIds } })
        .populate("class", "name gradeLevel")
        .lean();
      console.log(
        `  exam=${e.name} id=${e._id} session=${e.session} assessments=${assess.length} sections=${sections.length}`
      );
      for (const s of sections) {
        const n = await Student.countDocuments({
          academy: a._id,
          section: s._id,
          isActive: { $ne: false },
        });
        console.log(
          `    ${s.class?.name}/${s.name} grade=${s.class?.gradeLevel} students=${n}`
        );
      }
    }
  }
  await mongoose.connection.close();
};

run();
