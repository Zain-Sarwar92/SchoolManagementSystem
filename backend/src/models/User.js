import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["super_admin", "academy_admin", "teacher", "sub_account"];
const TEACHER_LEVELS = ["PRIMARY", "MATRIC", "INTERMEDIATE"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    teacherLevel: {
      type: String,
      enum: [...TEACHER_LEVELS, null],
      default: null,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export const USER_ROLES = ROLES;
export const USER_TEACHER_LEVELS = TEACHER_LEVELS;
export default mongoose.model("User", userSchema);
