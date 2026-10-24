import User from "../models/User.js";
import { generateToken, asyncHandler } from "../utils/helpers.js";
import { logActivity } from "../utils/logActivity.js";

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email })
    .select("+password")
    .populate(
      "academy",
      "name slug status logo moduleAcademyManagement moduleTestGenerator"
    );

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("Account is deactivated");
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

  if (user.academy) {
    void logActivity({
      user,
      action: "LOGIN",
      summary: `${user.name || user.email} logged in`,
      meta: { role: user.role },
    });
  }

  res.json({
    success: true,
    token: generateToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      teacherLevel: user.teacherLevel || null,
      academy: user.academy,
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      teacherLevel: req.user.teacherLevel || null,
      academy: req.user.academy,
    },
  });
});
