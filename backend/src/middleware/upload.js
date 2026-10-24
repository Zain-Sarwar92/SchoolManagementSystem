import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsRoot = path.join(__dirname, "../../uploads");
export const academyLogosDir = path.join(uploadsRoot, "academy-logos");
export const studentFilesDir = path.join(uploadsRoot, "student-files");

fs.mkdirSync(academyLogosDir, { recursive: true });
fs.mkdirSync(studentFilesDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, academyLogosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const studentFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, studentFilesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 40);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base || "file"}${ext}`);
  },
});

const logoFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Upload a JPG, PNG, WEBP, or GIF logo"));
  }
  cb(null, true);
};

const studentFileFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Upload an image, PDF, or Word document"));
  }
  cb(null, true);
};

export const uploadAcademyLogo = multer({
  storage: logoStorage,
  fileFilter: logoFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("logo");

export const uploadStudentFile = multer({
  storage: studentFileStorage,
  fileFilter: studentFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");
