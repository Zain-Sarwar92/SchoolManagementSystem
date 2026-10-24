import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../utils/helpers.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, token missing");
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate(
      "academy",
      "name slug status logo moduleAcademyManagement moduleTestGenerator"
    );

    if (!user || !user.isActive) {
      res.status(401);
      throw new Error("Not authorized, user unavailable");
    }

    if (
      (user.role === "academy_admin" ||
        user.role === "teacher" ||
        user.role === "sub_account") &&
      user.academy?.status === "suspended"
    ) {
      res.status(403);
      throw new Error("Academy is suspended. Contact support.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.message.includes("suspended") || error.message.includes("unavailable")) {
      throw error;
    }
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }
});

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    res.status(403);
    throw new Error("Forbidden: insufficient permissions");
  }
  next();
};

/** Gate routes by academy product module (Academy Management / Test Generator). */
export const requireAcademyModule = (moduleKey) => (req, res, next) => {
  const academy = req.user?.academy;
  if (!academy) {
    res.status(403);
    return next(new Error("No academy linked to this account"));
  }

  // Legacy academies (missing fields) keep access; new ones set flags explicitly.
  const readFlag = (field) => {
    if (academy[field] === undefined || academy[field] === null) return true;
    return Boolean(academy[field]);
  };

  const enabled =
    moduleKey === "ACADEMY_MANAGEMENT"
      ? readFlag("moduleAcademyManagement")
      : moduleKey === "TEST_GENERATOR"
        ? readFlag("moduleTestGenerator")
        : false;

  if (!enabled) {
    res.status(403);
    return next(
      new Error(
        moduleKey === "TEST_GENERATOR"
          ? "Test Generator is not enabled for this academy"
          : "Academy Management is not enabled for this academy"
      )
    );
  }

  next();
};
