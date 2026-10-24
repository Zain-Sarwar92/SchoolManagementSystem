import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@schoolsaas.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    const existing = await User.findOne({ email });

    if (existing) {
      console.log(`Super Admin already exists: ${email}`);
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
      console.log(`Password: ${password}`);
    }
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedSuperAdmin();
