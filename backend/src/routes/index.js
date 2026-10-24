import { Router } from "express";
import authRoutes from "./authRoutes.js";
import academyRoutes from "./academyRoutes.js";
import classRoutes from "./classRoutes.js";
import sectionRoutes from "./sectionRoutes.js";
import studentRoutes from "./studentRoutes.js";
import feeRoutes from "./feeRoutes.js";
import resultRoutes from "./resultRoutes.js";
import teacherRoutes from "./teacherRoutes.js";
import scheduleRoutes from "./scheduleRoutes.js";
import generatorRoutes from "./generatorRoutes.js";
import activityRoutes from "./activityRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "School Management API is running",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/academies", academyRoutes);
router.use("/classes", classRoutes);
router.use("/sections", sectionRoutes);
router.use("/students", studentRoutes);
router.use("/fees", feeRoutes);
router.use("/results", resultRoutes);
router.use("/teachers", teacherRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/generator", generatorRoutes);
router.use("/activities", activityRoutes);

export default router;
