import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import { academyLogosDir } from "./middleware/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPtsMediaRoot = path.resolve(__dirname, "../public/pts-media");

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("Fatal: JWT_SECRET must be set (min 16 characters) in .env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("Fatal: MONGO_URI must be set in .env");
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";

if (isProd && process.env.JWT_SECRET.length < 32) {
  console.warn(
    "Warning: JWT_SECRET should be at least 32 characters in production"
  );
}

if (isProd && (!process.env.CLIENT_URL || process.env.CLIENT_URL.includes("localhost"))) {
  console.warn(
    "Warning: CLIENT_URL should be your real HTTPS frontend origin in production"
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const ptsMediaRoot = process.env.PTS_MEDIA_ROOT
  ? path.resolve(process.env.PTS_MEDIA_ROOT)
  : defaultPtsMediaRoot;

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
app.use(morgan(isProd ? "combined" : "dev"));

/* Public: academy logos only (paper print / header). Student files are auth-gated. */
app.use(
  "/uploads/academy-logos",
  express.static(academyLogosDir, {
    fallthrough: true,
    index: false,
    dotfiles: "deny",
  })
);

/* Equation / diagram assets used inside question HTML */
app.use(
  "/pts-media",
  express.static(ptsMediaRoot, {
    fallthrough: true,
    index: false,
    dotfiles: "deny",
    maxAge: isProd ? "7d" : 0,
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

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.PTS_MEDIA_ROOT) {
    console.log(`pts-media root (default): ${ptsMediaRoot}`);
  } else {
    console.log(`pts-media root: ${ptsMediaRoot}`);
  }
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down…`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error("Error closing MongoDB:", err.message);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
