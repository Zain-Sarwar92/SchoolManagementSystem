import GeneratorPaper from "../../models/GeneratorPaper.js";
import { logActivity } from "../../utils/logActivity.js";
import { httpError } from "./httpError.js";
import {
  assertSectionsHaveMarks,
  normalizeSections,
  paperOwnerFilter,
  sectionMarks,
} from "./paperHelpers.js";

export async function listPapers(user, academyId) {
  const papers = await GeneratorPaper.find({
    academy: academyId,
    ...paperOwnerFilter(user),
  })
    .sort({ createdAt: -1 })
    .populate("createdBy", "name email")
    .lean();

  return { count: papers.length, papers };
}

export async function getPaper(user, academyId, paperId) {
  const paper = await GeneratorPaper.findOne({
    _id: paperId,
    academy: academyId,
    ...paperOwnerFilter(user),
  })
    .populate("createdBy", "name email")
    .lean();

  if (!paper) {
    throw httpError(404, "Paper not found");
  }
  return paper;
}

export async function createPaper(user, academyId, body = {}) {
  const title = String(body.title || "").trim();
  const classLabel = String(body.classLabel || "").trim();
  const subjectLabel = String(body.subjectLabel || "").trim();
  const boardLabel = String(body.boardLabel || "PTB").trim();
  const medium = ["english", "urdu", "dual"].includes(body.medium)
    ? body.medium
    : "english";
  const sectionsIn = Array.isArray(body.sections) ? body.sections : [];

  if (title.length < 2) {
    throw httpError(400, "Enter a paper title");
  }
  if (!classLabel || !subjectLabel) {
    throw httpError(400, "Select class and subject");
  }

  const sections = normalizeSections(sectionsIn);
  assertSectionsHaveMarks(sections);
  const totalMarks =
    Number(body.totalMarks) ||
    sections.reduce((sum, s) => sum + sectionMarks(s), 0);

  const paper = await GeneratorPaper.create({
    academy: academyId,
    createdBy: user._id,
    title,
    boardLabel,
    classLabel,
    subjectLabel,
    subject: body.subjectId || null,
    medium,
    distributionMode: body.distributionMode === "RANDOM" ? "RANDOM" : "BALANCED",
    totalMarks,
    durationMinutes: Number(body.durationMinutes) || 60,
    examDate: body.examDate ? new Date(body.examDate) : null,
    instructions: String(body.instructions || "").trim(),
    syllabusNote: String(body.syllabusNote || "").trim(),
    paperCategory: String(body.paperCategory || "").trim(),
    sections,
    status: "saved",
  });

  void logActivity({
    user,
    academyId,
    action: "PAPER_CREATE",
    summary: `Created paper “${title}” (${classLabel} · ${subjectLabel})`,
    meta: {
      paperId: String(paper._id),
      title,
      classLabel,
      subjectLabel,
      medium,
      totalMarks,
    },
  });

  return paper;
}

export async function updatePaper(user, academyId, paperId, body = {}) {
  const paper = await GeneratorPaper.findOne({
    _id: paperId,
    academy: academyId,
    ...paperOwnerFilter(user),
  });

  if (!paper) {
    throw httpError(404, "Paper not found");
  }

  if (body.title != null) {
    const title = String(body.title || "").trim();
    if (title.length < 2) {
      throw httpError(400, "Enter a paper title");
    }
    paper.title = title;
  }
  if (body.paperCategory != null) {
    paper.paperCategory = String(body.paperCategory || "").trim();
  }
  if (body.instructions != null) {
    paper.instructions = String(body.instructions || "").trim();
  }
  if (body.syllabusNote != null) {
    paper.syllabusNote = String(body.syllabusNote || "").trim();
  }
  if (body.examDate != null) {
    paper.examDate = body.examDate ? new Date(body.examDate) : null;
  }
  if (body.durationMinutes != null) {
    paper.durationMinutes = Number(body.durationMinutes) || 60;
  }

  if (Array.isArray(body.sections)) {
    paper.sections = normalizeSections(body.sections);
    assertSectionsHaveMarks(paper.sections);
  }

  paper.totalMarks =
    Number(body.totalMarks) ||
    paper.sections.reduce((sum, s) => sum + sectionMarks(s), 0);
  paper.status = "saved";

  await paper.save();

  void logActivity({
    user,
    academyId,
    action: "PAPER_UPDATE",
    summary: `Updated paper “${paper.title}”`,
    meta: {
      paperId: String(paper._id),
      title: paper.title,
      classLabel: paper.classLabel,
      subjectLabel: paper.subjectLabel,
    },
  });

  return paper;
}

export async function deletePaper(user, academyId, paperId) {
  const paper = await GeneratorPaper.findOneAndDelete({
    _id: paperId,
    academy: academyId,
    ...paperOwnerFilter(user),
  });

  if (!paper) {
    throw httpError(404, "Paper not found");
  }

  void logActivity({
    user,
    academyId,
    action: "PAPER_DELETE",
    summary: `Deleted paper “${paper.title}”`,
    meta: {
      paperId: String(paper._id),
      title: paper.title,
      classLabel: paper.classLabel,
      subjectLabel: paper.subjectLabel,
    },
  });

  return paper;
}
