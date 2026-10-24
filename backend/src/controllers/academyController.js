import Academy from "../models/Academy.js";
import User from "../models/User.js";
import { asyncHandler, slugify } from "../utils/helpers.js";

const ensureUniqueSlug = async (baseSlug) => {
  let slug = baseSlug || "academy";
  let counter = 1;

  while (await Academy.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

export const createAcademy = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    plan,
    adminName,
    adminEmail,
    adminPassword,
    moduleAcademyManagement,
    moduleTestGenerator,
  } = req.body;

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    res.status(400);
    throw new Error("Admin email already registered");
  }

  const slug = await ensureUniqueSlug(slugify(name));
  const logo = req.file
    ? `/uploads/academy-logos/${req.file.filename}`
    : String(req.body.logoUrl || "").trim();

  let academy;

  try {
    academy = await Academy.create({
      name,
      slug,
      email,
      phone,
      address,
      logo,
      plan,
      status: "active",
      moduleAcademyManagement: Boolean(moduleAcademyManagement),
      moduleTestGenerator: Boolean(moduleTestGenerator),
    });

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "academy_admin",
      academy: academy._id,
    });

    res.status(201).json({
      success: true,
      message: "Academy registered successfully",
      academy,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    if (academy?._id) {
      await Academy.findByIdAndDelete(academy._id);
    }
    if (req.file?.path) {
      const fs = await import("fs/promises");
      await fs.unlink(req.file.path).catch(() => {});
    }
    throw error;
  }
});

export const getAcademies = asyncHandler(async (req, res) => {
  const academies = await Academy.find().sort({ createdAt: -1 });

  const withAdmins = await Promise.all(
    academies.map(async (academy) => {
      const admin = await User.findOne({
        academy: academy._id,
        role: "academy_admin",
      }).select("name email isActive");

      return {
        ...academy.toObject(),
        admin,
      };
    })
  );

  res.json({
    success: true,
    count: withAdmins.length,
    academies: withAdmins,
  });
});

export const getMyAcademy = asyncHandler(async (req, res) => {
  if (!req.user.academy) {
    res.status(404);
    throw new Error("No academy linked to this account");
  }

  const academy = await Academy.findById(req.user.academy._id || req.user.academy);

  if (!academy) {
    res.status(404);
    throw new Error("Academy not found");
  }

  res.json({
    success: true,
    academy,
  });
});

export const updateAcademyStatus = asyncHandler(async (req, res) => {
  const academy = await Academy.findById(req.params.id);

  if (!academy) {
    res.status(404);
    throw new Error("Academy not found");
  }

  academy.status = req.body.status;
  await academy.save();

  res.json({
    success: true,
    message: `Academy ${academy.status}`,
    academy,
  });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [total, active, suspended] = await Promise.all([
    Academy.countDocuments(),
    Academy.countDocuments({ status: "active" }),
    Academy.countDocuments({ status: "suspended" }),
  ]);

  res.json({
    success: true,
    stats: { total, active, suspended },
  });
});
