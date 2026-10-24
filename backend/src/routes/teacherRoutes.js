import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  listTeacherLevels,
  getTeacherAssignmentOptions,
} from "../controllers/teacherController.js";
import {
  createTeacherSchema,
  updateTeacherSchema,
  validate,
} from "../middleware/validate.js";

const router = Router();

router.use(protect);
router.use(authorize("academy_admin"));

router.get("/levels", listTeacherLevels);
router.get("/assignment-options", getTeacherAssignmentOptions);
router.get("/", listTeachers);
router.post("/", validate(createTeacherSchema), createTeacher);
router.get("/:id", getTeacher);
router.put("/:id", validate(updateTeacherSchema), updateTeacher);
router.delete("/:id", deleteTeacher);

export default router;
