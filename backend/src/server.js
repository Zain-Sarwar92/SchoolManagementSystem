import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import { uploadsRoot } from "./middleware/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ptsMediaRoot = path.resolve(
  __dirname,
  "../../_compare_Test_System/public/pts-media"
);

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("Fatal: JWT_SECRET must be set (min 16 characters) in .env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("Fatal: MONGO_URI must be set in .env");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(uploadsRoot, { fallthrough: true }));
/* PTS equation / diagram assets used inside question HTML */
app.use(
  "/pts-media",
  express.static(ptsMediaRoot, {
    fallthrough: true,
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, try again later" },
});

app.use("/api", apiLimiter);
app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
