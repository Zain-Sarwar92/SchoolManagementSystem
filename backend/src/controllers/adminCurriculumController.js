import { asyncHandler } from "../utils/helpers.js";
import * as curriculum from "../services/admin/curriculumAdminService.js";

const cascadeFlag = (req) =>
  req.query.cascade === "true" || req.query.cascade === "1" || req.body?.cascade === true;

export const getBankStats = asyncHandler(async (_req, res) => {
  const stats = await curriculum.getBankStats();
  res.json({ success: true, stats });
});

/* Boards */
export const listBoards = asyncHandler(async (_req, res) => {
  const boards = await curriculum.listBoards();
  res.json({ success: true, boards });
});

export const createBoard = asyncHandler(async (req, res) => {
  const board = await curriculum.createBoard(req.body || {});
  res.status(201).json({ success: true, message: "Board created", board });
});

export const updateBoard = asyncHandler(async (req, res) => {
  const board = await curriculum.updateBoard(req.params.id, req.body || {});
  res.json({ success: true, message: "Board updated", board });
});

export const deleteBoard = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteBoard(req.params.id, { cascade: cascadeFlag(req) });
  res.json({ success: true, message: "Board deleted", ...result });
});

/* Classes */
export const listClasses = asyncHandler(async (req, res) => {
  const classes = await curriculum.listClasses(req.params.boardId);
  res.json({ success: true, classes });
});

export const createClass = asyncHandler(async (req, res) => {
  const klass = await curriculum.createClass(req.body || {});
  res.status(201).json({ success: true, message: "Class created", class: klass });
});

export const updateClass = asyncHandler(async (req, res) => {
  const klass = await curriculum.updateClass(req.params.id, req.body || {});
  res.json({ success: true, message: "Class updated", class: klass });
});

export const deleteClass = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteClass(req.params.id, { cascade: cascadeFlag(req) });
  res.json({ success: true, message: "Class deleted", ...result });
});

/* Subjects */
export const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await curriculum.listSubjects(req.params.classId);
  res.json({ success: true, subjects });
});

export const createSubject = asyncHandler(async (req, res) => {
  const subject = await curriculum.createSubject(req.body || {});
  res.status(201).json({ success: true, message: "Subject created", subject });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await curriculum.updateSubject(req.params.id, req.body || {});
  res.json({ success: true, message: "Subject updated", subject });
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteSubject(req.params.id, { cascade: cascadeFlag(req) });
  res.json({ success: true, message: "Subject deleted", ...result });
});

/* Chapters */
export const listChapters = asyncHandler(async (req, res) => {
  const chapters = await curriculum.listChapters(req.params.subjectId);
  res.json({ success: true, chapters });
});

export const createChapter = asyncHandler(async (req, res) => {
  const chapter = await curriculum.createChapter(req.body || {});
  res.status(201).json({ success: true, message: "Chapter created", chapter });
});

export const updateChapter = asyncHandler(async (req, res) => {
  const chapter = await curriculum.updateChapter(req.params.id, req.body || {});
  res.json({ success: true, message: "Chapter updated", chapter });
});

export const deleteChapter = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteChapter(req.params.id, { cascade: cascadeFlag(req) });
  res.json({ success: true, message: "Chapter deleted", ...result });
});

/* Topics */
export const listTopics = asyncHandler(async (req, res) => {
  const topics = await curriculum.listTopics(req.params.chapterId);
  res.json({ success: true, topics });
});

export const createTopic = asyncHandler(async (req, res) => {
  const topic = await curriculum.createTopic(req.body || {});
  res.status(201).json({ success: true, message: "Topic created", topic });
});

export const updateTopic = asyncHandler(async (req, res) => {
  const topic = await curriculum.updateTopic(req.params.id, req.body || {});
  res.json({ success: true, message: "Topic updated", topic });
});

export const deleteTopic = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteTopic(req.params.id, { cascade: cascadeFlag(req) });
  res.json({ success: true, message: "Topic deleted", ...result });
});

/* Questions */
export const getSubjectQuestionSummary = asyncHandler(async (req, res) => {
  const summary = await curriculum.getSubjectQuestionSummary(req.params.subjectId);
  res.json({ success: true, summary });
});

export const listQuestions = asyncHandler(async (req, res) => {
  const result = await curriculum.listQuestions(req.query || {});
  res.json({ success: true, ...result });
});

export const getQuestion = asyncHandler(async (req, res) => {
  const question = await curriculum.getQuestion(req.params.id);
  res.json({ success: true, question });
});

export const createQuestion = asyncHandler(async (req, res) => {
  const question = await curriculum.createQuestion(req.body || {});
  res.status(201).json({ success: true, message: "Question created", question });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await curriculum.updateQuestion(req.params.id, req.body || {});
  res.json({ success: true, message: "Question updated", question });
});

export const setQuestionActive = asyncHandler(async (req, res) => {
  const question = await curriculum.setQuestionActive(req.params.id, req.body?.isActive);
  res.json({
    success: true,
    message: question.isActive ? "Question activated" : "Question deactivated",
    question,
  });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const result = await curriculum.deleteQuestion(req.params.id);
  res.json({ success: true, message: "Question deleted", ...result });
});
