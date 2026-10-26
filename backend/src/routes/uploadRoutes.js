import { Router } from "express";
import path from "path";
import fs from "fs";
import { protect, authorize } from "../middleware/auth.js";
import { studentFilesDir } from "../middleware/upload.js";
import { asyncHandler } from "../utils/helpers.js";

const router = Router();

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Authenticated download for student custom-field files.
 * Public static serving of this folder is disabled.
 */
router.get(
  "/student-files/:filename",
  protect,
  authorize("academy_admin", "teacher"),
  asyncHandler(async (req, res) => {
    const filename = String(req.params.filename || "");
    if (!SAFE_NAME.test(filename) || filename.includes("..")) {
      res.status(400);
      throw new Error("Invalid file name");
    }

    const absolute = path.resolve(studentFilesDir, filename);
    const relative = path.relative(studentFilesDir, absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      res.status(400);
      throw new Error("Invalid file path");
    }

    if (!fs.existsSync(absolute)) {
      res.status(404);
      throw new Error("File not found");
    }

    res.sendFile(absolute);
  })
);

export default router;
