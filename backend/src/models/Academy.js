import mongoose from "mongoose";

const academySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    plan: {
      type: String,
      enum: ["free", "basic", "pro"],
      default: "free",
    },
    /** Product access: Academy Management app (students / fees / results) */
    moduleAcademyManagement: {
      type: Boolean,
      default: true,
    },
    /** Product access: Test Generator app (schedules / papers) */
    moduleTestGenerator: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Academy", academySchema);
