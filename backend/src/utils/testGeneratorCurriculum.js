import Class from "../models/Class.js";
import Section from "../models/Section.js";

/** board-style built-in grades — no manual Classes/Sections modules needed. */
const DEFAULT_GRADES = [
  { gradeLevel: 1, name: "Class 1" },
  { gradeLevel: 2, name: "Class 2" },
  { gradeLevel: 3, name: "Class 3" },
  { gradeLevel: 4, name: "Class 4" },
  { gradeLevel: 5, name: "Class 5" },
  { gradeLevel: 6, name: "Class 6" },
  { gradeLevel: 7, name: "Class 7" },
  { gradeLevel: 8, name: "Class 8" },
  { gradeLevel: 9, name: "Class 9" },
  { gradeLevel: 10, name: "Class 10" },
  { gradeLevel: 11, name: "Class 11" },
  { gradeLevel: 12, name: "Class 12" },
];

const DEFAULT_SECTION = "Main";

/**
 * Ensure Test Generator academies have a ready curriculum catalog
 * (classes + one default section each) without exposing Classes/Sections UI.
 */
export async function ensureTestGeneratorCurriculum(academyId) {
  const existing = await Class.find({ academy: academyId }).lean();
  const byGrade = new Map(
    existing
      .filter((c) => c.gradeLevel != null)
      .map((c) => [Number(c.gradeLevel), c])
  );
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  const ensuredClasses = [];

  for (const row of DEFAULT_GRADES) {
    let klass =
      byGrade.get(row.gradeLevel) || byName.get(row.name.toLowerCase());

    if (!klass) {
      try {
        klass = await Class.create({
          academy: academyId,
          name: row.name,
          gradeLevel: row.gradeLevel,
          description: "Built-in Test Generator curriculum",
          isActive: true,
        });
        klass = klass.toObject();
      } catch (err) {
        if (err?.code !== 11000) throw err;
        klass = await Class.findOne({
          academy: academyId,
          name: row.name,
        }).lean();
      }
    } else if (!klass.isActive) {
      await Class.updateOne({ _id: klass._id }, { $set: { isActive: true } });
      klass = { ...klass, isActive: true };
    }

    if (!klass) continue;
    ensuredClasses.push(klass);

    const sectionCount = await Section.countDocuments({
      academy: academyId,
      class: klass._id,
      isActive: true,
    });
    if (sectionCount > 0) continue;

    try {
      await Section.create({
        academy: academyId,
        class: klass._id,
        name: DEFAULT_SECTION,
        description: "Default section for Test Generator",
        isActive: true,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      await Section.updateOne(
        { academy: academyId, class: klass._id, name: DEFAULT_SECTION },
        { $set: { isActive: true } }
      );
    }
  }

  return ensuredClasses;
}
