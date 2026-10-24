import mongoose from "mongoose";
import { httpError } from "./httpError.js";

export function asQuestionRef(value) {
  if (!value) return null;
  const id = String(value);
  return mongoose.isValidObjectId(id) ? id : null;
}

export function scoredCount(questionCount, attemptCount) {
  const attempt = Number(attemptCount);
  if (!Number.isFinite(attempt) || attempt <= 0) return questionCount;
  return Math.min(questionCount, attempt);
}

export function sectionMarks(section) {
  const each = Number(section.marksEach);
  if (!Number.isFinite(each) || each <= 0) return 0;
  const n = scoredCount(
    section.questions?.length || 0,
    section.attemptCount
  );
  return n * each;
}

export function paperOwnerFilter(user) {
  /* Teachers (AM) and TG sub accounts only see their own papers */
  if (user?.role === "teacher" || user?.role === "sub_account") {
    return { createdBy: user._id };
  }
  return {};
}

export function normalizeSections(sectionsIn = []) {
  return sectionsIn.map((section, sIndex) => {
    const marksRaw = Number(section.marksEach);
    const marksEach =
      Number.isFinite(marksRaw) && marksRaw > 0 ? marksRaw : 0;

    return {
      key: section.key || `sec-${sIndex + 1}`,
      type: section.type,
      subType: section.subType || null,
      order: Number(section.order) || sIndex + 1,
      attemptCount: Number(section.attemptCount) || 0,
      marksEach,
      questions: (section.questions || []).map((q, index) => {
        const qMarks = Number(q.marks);
        const marks =
          Number.isFinite(qMarks) && qMarks > 0
            ? qMarks
            : marksEach > 0
              ? marksEach
              : 0;
        return {
          question: asQuestionRef(q.question || q.id),
          type: q.type || section.type,
          text: q.text,
          textUrdu: q.textUrdu || null,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          marks,
          order: index,
        };
      }),
    };
  });
}

/** Teacher must set per-section marks — never invent defaults. */
export function assertSectionsHaveMarks(sections = []) {
  if (!sections.length) {
    throw httpError(400, "Add at least one question section");
  }
  for (const section of sections) {
    if (!(Number(section.marksEach) > 0)) {
      throw httpError(
        400,
        "Enter marks for each question (Marks each) before saving"
      );
    }
  }
}
