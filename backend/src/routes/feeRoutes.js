import { Router } from "express";
import {
  collectFee,
  createFeeHead,
  deleteFeeHead,
  generateFeeCharges,
  getFeeSummary,
  getStudentLedger,
  listDues,
  listFeeHeads,
  searchFeeStudents,
  updateFeeHead,
  waiveCharge,
} from "../controllers/feeController.js";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  collectFeeSchema,
  createFeeHeadSchema,
  generateFeesSchema,
  updateFeeHeadSchema,
  validate,
} from "../middleware/validate.js";

const router = Router();

router.use(protect, authorize("academy_admin"), requireAcademyModule("ACADEMY_MANAGEMENT"));

router.get("/heads", listFeeHeads);
router.post("/heads", validate(createFeeHeadSchema), createFeeHead);
router.patch("/heads/:id", validate(updateFeeHeadSchema), updateFeeHead);
router.delete("/heads/:id", deleteFeeHead);

router.get("/summary", getFeeSummary);
router.get("/dues", listDues);
router.get("/students/search", searchFeeStudents);
router.get("/student/:studentId", getStudentLedger);

router.post("/generate", validate(generateFeesSchema), generateFeeCharges);
router.post("/collect", validate(collectFeeSchema), collectFee);
router.post("/charges/:id/waive", waiveCharge);

export default router;
