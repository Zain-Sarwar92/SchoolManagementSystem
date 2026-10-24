import { Router } from "express";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  getGeneratorCatalog,
  getSubjectSyllabus,
  searchQuestionPool,
  pickRandomQuestions,
  listGeneratorPapers,
  getGeneratorPaper,
  createGeneratorPaper,
  updateGeneratorPaper,
  deleteGeneratorPaper,
} from "../controllers/generatorController.js";
import subAccountRoutes from "./subAccountRoutes.js";

const router = Router();

router.use(protect);
router.use(requireAcademyModule("TEST_GENERATOR"));

/* TG sub accounts — separate from AM /teachers; admin only; no seat limit */
router.use(
  "/sub-accounts",
  authorize("academy_admin", "super_admin"),
  subAccountRoutes
);

router.use(authorize("academy_admin", "teacher", "sub_account", "super_admin"));

router.get("/catalog", getGeneratorCatalog);
router.get("/subjects/:subjectId/syllabus", getSubjectSyllabus);
router.post("/pool/search", searchQuestionPool);
router.post("/pool/pick", pickRandomQuestions);
router.get("/papers", listGeneratorPapers);
router.post("/papers", createGeneratorPaper);
router.get("/papers/:id", getGeneratorPaper);
router.put("/papers/:id", updateGeneratorPaper);
router.delete("/papers/:id", deleteGeneratorPaper);

export default router;
