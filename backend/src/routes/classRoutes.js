import { Router } from "express";
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} from "../controllers/classController.js";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  validate,
  createClassSchema,
  updateClassSchema,
} from "../middleware/validate.js";

const router = Router();

router.use(
  protect,
  authorize("academy_admin"),
  requireAcademyModule("ACADEMY_MANAGEMENT")
);

router
  .route("/")
  .get(getClasses)
  .post(validate(createClassSchema), createClass);

router
  .route("/:id")
  .put(validate(updateClassSchema), updateClass)
  .delete(deleteClass);

export default router;
