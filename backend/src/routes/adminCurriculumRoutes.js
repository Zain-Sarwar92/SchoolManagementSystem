import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/adminCurriculumController.js";

const router = Router();

router.use(protect, authorize("super_admin"));

router.get("/stats", ctrl.getBankStats);

router.get("/boards", ctrl.listBoards);
router.post("/boards", ctrl.createBoard);
router.patch("/boards/:id", ctrl.updateBoard);
router.delete("/boards/:id", ctrl.deleteBoard);

router.get("/boards/:boardId/classes", ctrl.listClasses);
router.post("/classes", ctrl.createClass);
router.patch("/classes/:id", ctrl.updateClass);
router.delete("/classes/:id", ctrl.deleteClass);

router.get("/classes/:classId/subjects", ctrl.listSubjects);
router.post("/subjects", ctrl.createSubject);
router.patch("/subjects/:id", ctrl.updateSubject);
router.delete("/subjects/:id", ctrl.deleteSubject);

router.get("/subjects/:subjectId/chapters", ctrl.listChapters);
router.post("/chapters", ctrl.createChapter);
router.patch("/chapters/:id", ctrl.updateChapter);
router.delete("/chapters/:id", ctrl.deleteChapter);

router.get("/chapters/:chapterId/topics", ctrl.listTopics);
router.post("/topics", ctrl.createTopic);
router.patch("/topics/:id", ctrl.updateTopic);
router.delete("/topics/:id", ctrl.deleteTopic);

router.get("/subjects/:subjectId/question-summary", ctrl.getSubjectQuestionSummary);

router.get("/questions", ctrl.listQuestions);
router.get("/questions/:id", ctrl.getQuestion);
router.post("/questions", ctrl.createQuestion);
router.patch("/questions/:id", ctrl.updateQuestion);
router.patch("/questions/:id/active", ctrl.setQuestionActive);
router.delete("/questions/:id", ctrl.deleteQuestion);

export default router;
