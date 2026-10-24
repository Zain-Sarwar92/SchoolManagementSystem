import { Router } from "express";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  getScheduleCatalog,
  listSchedules,
  getSchedule,
  createSchedule,
  cancelSchedule,
  deleteSchedule,
  listMyAssignments,
  updateMySyllabus,
  updateAssignmentSyllabus,
  createPaperForAssignment,
  deletePaperForAssignment,
} from "../controllers/scheduleController.js";

const router = Router();

router.use(protect);
// Schedules belong to Academy Management exam planning — not Test Generator.
router.use(requireAcademyModule("ACADEMY_MANAGEMENT"));

// Teacher workspace
router.get(
  "/my-assignments",
  authorize("teacher"),
  listMyAssignments
);
router.patch(
  "/my-assignments/:assignmentId/syllabus",
  authorize("teacher"),
  updateMySyllabus
);
router.post(
  "/my-assignments/:assignmentId/paper",
  authorize("teacher"),
  createPaperForAssignment
);
router.delete(
  "/my-assignments/:assignmentId/paper",
  authorize("teacher"),
  deletePaperForAssignment
);

// Academy admin
router.get("/catalog", authorize("academy_admin"), getScheduleCatalog);
router.get("/", authorize("academy_admin"), listSchedules);
router.post("/", authorize("academy_admin"), createSchedule);
router.patch(
  "/assignments/:assignmentId/syllabus",
  authorize("academy_admin"),
  updateAssignmentSyllabus
);
router.get("/:id", authorize("academy_admin"), getSchedule);
router.post("/:id/cancel", authorize("academy_admin"), cancelSchedule);
router.delete("/:id", authorize("academy_admin"), deleteSchedule);

export default router;
