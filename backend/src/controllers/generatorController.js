import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { bank, paperService } from "../services/generator/index.js";

/** GET /generator/catalog */
export const getGeneratorCatalog = asyncHandler(async (_req, res) => {
  const result = await bank.getCatalog();
  res.json({ success: true, ...result });
});

/** GET /generator/subjects/:subjectId/syllabus */
export const getSubjectSyllabus = asyncHandler(async (req, res) => {
  const result = await bank.getSubjectSyllabus(req.params.subjectId);
  res.json({ success: true, ...result });
});

/** POST /generator/pool/search */
export const searchQuestionPool = asyncHandler(async (req, res) => {
  const result = await bank.searchQuestionPool(req.body || {});
  res.json({ success: true, ...result });
});

/** POST /generator/pool/pick */
export const pickRandomQuestions = asyncHandler(async (req, res) => {
  const result = await bank.pickRandomQuestions(req.body || {});
  res.json({ success: true, ...result });
});

export const listGeneratorPapers = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const result = await paperService.listPapers(req.user, academyId);
  res.json({ success: true, ...result });
});

export const getGeneratorPaper = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const paper = await paperService.getPaper(
    req.user,
    academyId,
    req.params.id
  );
  res.json({ success: true, paper });
});

export const createGeneratorPaper = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const paper = await paperService.createPaper(
    req.user,
    academyId,
    req.body || {}
  );
  res.status(201).json({
    success: true,
    message: "Paper saved",
    paper,
  });
});

export const updateGeneratorPaper = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const paper = await paperService.updatePaper(
    req.user,
    academyId,
    req.params.id,
    req.body || {}
  );
  res.json({
    success: true,
    message: "Paper updated",
    paper,
  });
});

export const deleteGeneratorPaper = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  await paperService.deletePaper(req.user, academyId, req.params.id);
  res.json({ success: true, message: "Paper deleted" });
});
