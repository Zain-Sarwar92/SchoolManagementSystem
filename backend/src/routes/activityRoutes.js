import { Router } from "express";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  listAccountActivities,
  createAccountActivity,
} from "../controllers/activityController.js";

const router = Router();

router.use(protect);
router.use(requireAcademyModule("TEST_GENERATOR"));

/* Admin audit log */
router.get(
  "/",
  authorize("academy_admin", "super_admin"),
  listAccountActivities
);

/* Client-reported print (admin, AM teacher, or TG sub account) */
router.post(
  "/",
  authorize("academy_admin", "teacher", "sub_account", "super_admin"),
  createAccountActivity
);

export default router;
