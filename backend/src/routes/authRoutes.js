import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate, loginSchema } from "../middleware/validate.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 15 minutes.",
  },
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.get("/me", protect, getMe);

export default router;
