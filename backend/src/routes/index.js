import { Router } from "express";
import mongoose from "mongoose";
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
import uploadRoutes from "./uploadRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoOk = mongoState === 1;
  const payload = {
    success: true,
    message: "School Management API is running",
    timestamp: new Date().toISOString(),
    mongo: mongoOk ? "connected" : "disconnected",
    ready: mongoOk,
  };

  if (!mongoOk) {
    return res.status(503).json({
      ...payload,
      success: false,
      message: "API up but MongoDB is not connected",
    });
  }

  res.json(payload);
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
router.use("/uploads", uploadRoutes);

export default router;
