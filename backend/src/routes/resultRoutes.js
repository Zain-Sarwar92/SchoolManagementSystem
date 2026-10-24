import { Router } from "express";
import {
  addExamSubjects,
  compileResults,
  createExam,
  deleteAssessment,
  deleteExam,
  deleteSectionExamResult,
  getAssessmentMarks,
  getClassSections,
  getExamSubjects,
  getGazette,
  getResultsHub,
  getSectionExams,
  getStudentResultReport,
  listExams,
  saveAssessmentMarks,
} from "../controllers/resultController.js";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  addExamSubjectsSchema,
  createExamSchema,
  saveMarksSchema,
  validate,
} from "../middleware/validate.js";

const router = Router();

router.use(protect, authorize("academy_admin"), requireAcademyModule("ACADEMY_MANAGEMENT"));

router.get("/hub", getResultsHub);
router.get("/classes/:classId", getClassSections);
router.get("/students/:studentId/report", getStudentResultReport);

router.get("/exams", listExams);
router.post("/exams", validate(createExamSchema), createExam);
router.post("/compile", compileResults);
router.delete("/exams/:id", deleteExam);

router.get("/sections/:sectionId", getSectionExams);
router.get("/sections/:sectionId/exams/:examId", getExamSubjects);
router.post(
  "/sections/:sectionId/exams/:examId/subjects",
  validate(addExamSubjectsSchema),
  addExamSubjects
);
router.delete(
  "/sections/:sectionId/exams/:examId",
  deleteSectionExamResult
);
router.get("/sections/:sectionId/exams/:examId/gazette", getGazette);

router.delete("/assessments/:id", deleteAssessment);
router.get("/assessments/:id/marks", getAssessmentMarks);
router.put(
  "/assessments/:id/marks",
  validate(saveMarksSchema),
  saveAssessmentMarks
);

export default router;
