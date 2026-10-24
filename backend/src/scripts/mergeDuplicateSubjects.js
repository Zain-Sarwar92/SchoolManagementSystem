/**
 * Merge duplicate Subject docs that share the same name.
 * Keeps the oldest (_id asc), re-points refs, deletes extras.
 */
import "dotenv/config";
import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentSubject from "../models/StudentSubject.js";
import Curriculum from "../models/Curriculum.js";
import TestScheduleSubjectClass from "../models/TestScheduleSubjectClass.js";
import TestPaper from "../models/TestPaper.js";
import SubjectAssessment from "../models/SubjectAssessment.js";

async function repoint(Model, field, fromId, toId) {
  const res = await Model.updateMany(
    { [field]: fromId },
    { $set: { [field]: toId } }
  );
  return res.modifiedCount || 0;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const all = await Subject.find({}).sort({ _id: 1 }).lean();
  const groups = new Map();
  for (const s of all) {
    const list = groups.get(s.name) || [];
    list.push(s);
    groups.set(s.name, list);
  }

  let merged = 0;
  for (const [name, list] of groups.entries()) {
    if (list.length < 2) continue;
    const keep = list[0];
    const drop = list.slice(1);
    console.log(
      `Merge "${name}": keep ${keep._id}, drop ${drop.map((d) => d._id).join(", ")}`
    );

    for (const dupe of drop) {
      // Teacher assignments: move, skip unique clashes
      const rows = await TeacherAssignment.find({ subject: dupe._id }).lean();
      for (const row of rows) {
        const clash = await TeacherAssignment.findOne({
          teacher: row.teacher,
          class: row.class,
          section: row.section,
          subject: keep._id,
        });
        if (clash) {
          await TeacherAssignment.deleteOne({ _id: row._id });
        } else {
          await TeacherAssignment.updateOne(
            { _id: row._id },
            { $set: { subject: keep._id } }
          );
        }
      }

      const studentSubjects = await StudentSubject.find({
        subject: dupe._id,
      }).lean();
      for (const row of studentSubjects) {
        const clash = await StudentSubject.findOne({
          student: row.student,
          subject: keep._id,
        });
        if (clash) await StudentSubject.deleteOne({ _id: row._id });
        else {
          await StudentSubject.updateOne(
            { _id: row._id },
            { $set: { subject: keep._id } }
          );
        }
      }

      await Curriculum.updateMany(
        { subjects: dupe._id },
        { $set: { "subjects.$[elem]": keep._id } },
        { arrayFilters: [{ elem: dupe._id }] }
      );

      await repoint(TestScheduleSubjectClass, "subject", dupe._id, keep._id);
      await repoint(TestPaper, "subject", dupe._id, keep._id);
      await repoint(SubjectAssessment, "subject", dupe._id, keep._id);

      await Subject.deleteOne({ _id: dupe._id });
      merged += 1;
    }
  }

  console.log(`Done. Removed ${merged} duplicate subject(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
