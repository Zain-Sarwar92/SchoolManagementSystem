import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const WEAK_DEFAULTS = new Set([
  "SuperAdmin@123",
  "superadmin@schoolsaas.com",
  "admin",
  "password",
  "Password123",
]);

const seedSuperAdmin = async () => {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    if (!email || !password) {
      console.error(
        "Fatal: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env before seeding"
      );
      process.exitCode = 1;
      return;
    }

    if (isProd && (WEAK_DEFAULTS.has(password) || WEAK_DEFAULTS.has(email))) {
      console.error(
        "Fatal: refuse weak/default Super Admin credentials in production"
      );
      process.exitCode = 1;
      return;
    }

    if (!isProd && (WEAK_DEFAULTS.has(password) || password.length < 10)) {
      console.warn(
        "Warning: Super Admin password is weak — use a long unique password before any deploy"
      );
    }

    if (password.length < 10) {
      console.error("Fatal: SUPER_ADMIN_PASSWORD must be at least 10 characters");
      process.exitCode = 1;
      return;
    }

    await connectDB();

    const existing = await User.findOne({ email });
    const forceReset = process.env.SUPER_ADMIN_FORCE_RESET === "1";

    if (existing) {
      if (forceReset) {
        existing.name = name;
        existing.password = password;
        existing.role = "super_admin";
        await existing.save();
        console.log(`Super Admin password reset for: ${email}`);
      } else {
        console.log(`Super Admin already exists: ${email}`);
        console.log("Tip: set SUPER_ADMIN_FORCE_RESET=1 to update password");
      }
    } else {
      await User.create({
        name,
        email,
        password,
        role: "super_admin",
        academy: null,
      });

      console.log("Super Admin created successfully");
      console.log(`Email: ${email}`);
      if (!isProd) {
        console.log("Password: (value from SUPER_ADMIN_PASSWORD — not echoed in production)");
        console.log(`Password: ${password}`);
      } else {
        console.log("Password: set from SUPER_ADMIN_PASSWORD (not printed)");
      }
    }
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedSuperAdmin();
