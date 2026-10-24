import { Router } from "express";
import {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  toggleStudentActive,
  promoteStudent,
  getGroupsForClass,
  getNextRoll,
} from "../controllers/studentController.js";
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  uploadCustomFieldFile,
} from "../controllers/customFieldController.js";
import { protect, authorize, requireAcademyModule } from "../middleware/auth.js";
import {
  validate,
  createStudentSchema,
  updateStudentSchema,
  promoteStudentSchema,
} from "../middleware/validate.js";
import { uploadStudentFile } from "../middleware/upload.js";

const router = Router();

router.use(protect, authorize("academy_admin"), requireAcademyModule("ACADEMY_MANAGEMENT"));

router.get("/groups-for-class/:classId", getGroupsForClass);
router.get("/next-roll/:sectionId", getNextRoll);

router
  .route("/custom-fields")
  .get(listCustomFields)
  .post(createCustomField);

router
  .route("/custom-fields/:id")
  .put(updateCustomField)
  .delete(deleteCustomField);

router.post("/upload-file", (req, res, next) => {
  uploadStudentFile(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || "File upload failed"));
    }
    return uploadCustomFieldFile(req, res, next);
  });
});

router
  .route("/")
  .get(getStudents)
  .post(validate(createStudentSchema), createStudent);

router.post("/:id/promote", validate(promoteStudentSchema), promoteStudent);

router
  .route("/:id")
  .get(getStudent)
  .put(validate(updateStudentSchema), updateStudent)
  .delete(deleteStudent);

router.patch("/:id/toggle-active", toggleStudentActive);

export default router;
