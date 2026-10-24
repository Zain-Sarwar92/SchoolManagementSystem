import User from "../../models/User.js";
import { logActivity } from "../../utils/logActivity.js";
import { httpError } from "./httpError.js";

const ROLE = "sub_account";

function serialize(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isActive: user.isActive !== false,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listSubAccounts(academyId, { includeInactive = true } = {}) {
  const filter = { academy: academyId, role: ROLE };
  if (!includeInactive) filter.isActive = true;

  const rows = await User.find(filter).sort({ name: 1 }).lean();
  return rows.map(serialize);
}

export async function createSubAccount(actor, academyId, body = {}) {
  const name = String(body.name || "").trim();
  const emailNorm = String(body.email || "").trim().toLowerCase();
  const password = body.password;

  if (name.length < 2) {
    throw httpError(400, "Name is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw httpError(400, "Enter a valid email address");
  }
  if (!password || String(password).length < 6) {
    throw httpError(400, "Password must be at least 6 characters");
  }

  const existing = await User.findOne({ email: emailNorm });
  if (existing) {
    throw httpError(400, "Email already registered");
  }

  const user = await User.create({
    name,
    email: emailNorm,
    password,
    role: ROLE,
    teacherLevel: null,
    academy: academyId,
    isActive: true,
  });

  void logActivity({
    user: actor,
    academyId,
    action: "SUB_ACCOUNT_CREATE",
    summary: `Created sub account “${user.name}” (${user.email})`,
    meta: {
      subAccountId: String(user._id),
      name: user.name,
      email: user.email,
    },
  });

  return serialize(user.toObject());
}

export async function updateSubAccount(actor, academyId, id, body = {}) {
  const user = await User.findOne({
    _id: id,
    academy: academyId,
    role: ROLE,
  });
  if (!user) {
    throw httpError(404, "Sub account not found");
  }

  if (body.name != null) {
    const name = String(body.name || "").trim();
    if (name.length < 2) throw httpError(400, "Name is required");
    user.name = name;
  }

  if (body.email != null) {
    const nextEmail = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw httpError(400, "Enter a valid email address");
    }
    const clash = await User.findOne({
      email: nextEmail,
      _id: { $ne: user._id },
    });
    if (clash) throw httpError(400, "Email already registered");
    user.email = nextEmail;
  }

  if (typeof body.isActive === "boolean") {
    user.isActive = body.isActive;
  }

  if (body.password) {
    if (String(body.password).length < 6) {
      throw httpError(400, "Password must be at least 6 characters");
    }
    user.password = body.password;
  }

  await user.save();

  void logActivity({
    user: actor,
    academyId,
    action: "SUB_ACCOUNT_UPDATE",
    summary: `Updated sub account “${user.name}” (${user.email})`,
    meta: {
      subAccountId: String(user._id),
      name: user.name,
      email: user.email,
      isActive: user.isActive,
    },
  });

  return serialize(user.toObject());
}

export async function deleteSubAccount(actor, academyId, id) {
  const user = await User.findOne({
    _id: id,
    academy: academyId,
    role: ROLE,
  });
  if (!user) {
    throw httpError(404, "Sub account not found");
  }
  if (user.isActive) {
    throw httpError(400, "Deactivate the sub account before deleting");
  }

  const snapshot = {
    subAccountId: String(user._id),
    name: user.name,
    email: user.email,
  };

  await user.deleteOne();

  void logActivity({
    user: actor,
    academyId,
    action: "SUB_ACCOUNT_DELETE",
    summary: `Deleted sub account “${snapshot.name}” (${snapshot.email})`,
    meta: snapshot,
  });

  return snapshot;
}
