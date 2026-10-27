import { Router } from "express";
import {
  createAcademy,
  getAcademies,
  getMyAcademy,
  updateAcademyStatus,
  updateAcademyModules,
  getDashboardStats,
} from "../controllers/academyController.js";
import { getOpsDashboard } from "../controllers/opsDashboardController.js";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import { uploadAcademyLogo } from "../middleware/upload.js";
import {
  validate,
  createAcademySchema,
  updateAcademyStatusSchema,
  updateAcademyModulesSchema,
  requireAcademyLogo,
} from "../middleware/validate.js";

const router = Router();

const handleLogoUpload = (req, res, next) => {
  uploadAcademyLogo(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || "Logo upload failed"));
    }
    next();
  });
};

router.use(protect);

router.get("/me", authorize("academy_admin"), getMyAcademy);
router.get(
  "/me/ops-dashboard",
  authorize("academy_admin"),
  requireAcademyModule("ACADEMY_MANAGEMENT"),
  getOpsDashboard
);
router.get("/stats", authorize("super_admin"), getDashboardStats);

router
  .route("/")
  .get(authorize("super_admin"), getAcademies)
  .post(
    authorize("super_admin"),
    handleLogoUpload,
    requireAcademyLogo,
    validate(createAcademySchema),
    createAcademy
  );

router.patch(
  "/:id/status",
  authorize("super_admin"),
  validate(updateAcademyStatusSchema),
  updateAcademyStatus
);

router.patch(
  "/:id/modules",
  authorize("super_admin"),
  validate(updateAcademyModulesSchema),
  updateAcademyModules
);

export default router;
