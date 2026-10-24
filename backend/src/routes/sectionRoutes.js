import { Router } from "express";
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
} from "../controllers/sectionController.js";
import { protect, authorize } from "../middleware/auth.js";
import {
  validate,
  createSectionSchema,
  updateSectionSchema,
} from "../middleware/validate.js";

const router = Router();

router.use(protect, authorize("academy_admin"));

router
  .route("/")
  .get(getSections)
  .post(validate(createSectionSchema), createSection);

router
  .route("/:id")
  .put(validate(updateSectionSchema), updateSection)
  .delete(deleteSection);

export default router;
