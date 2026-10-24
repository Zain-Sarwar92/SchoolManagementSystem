import mongoose from "mongoose";
import AccountActivity, {
  ACTIVITY_ACTIONS,
} from "../../models/AccountActivity.js";
import { logActivity } from "../../utils/logActivity.js";
import { httpError } from "./httpError.js";

const CLIENT_ALLOWED = new Set(["PAPER_PRINT"]);

/** Parse action / actions query into a validated list (or null = all). */
function parseActionFilter(query = {}) {
  const single = String(query.action || "").trim().toUpperCase();
  const multi = String(query.actions || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (multi.length) {
    const allowed = multi.filter((a) => ACTIVITY_ACTIONS.includes(a));
    return allowed.length ? allowed : null;
  }
  if (single && ACTIVITY_ACTIONS.includes(single)) {
    return [single];
  }
  return null;
}

function asAcademyObjectId(academyId) {
  if (academyId instanceof mongoose.Types.ObjectId) return academyId;
  if (mongoose.isValidObjectId(academyId)) {
    return new mongoose.Types.ObjectId(String(academyId));
  }
  return academyId;
}

export async function listActivities(academyId, query = {}) {
  if (!academyId) {
    throw httpError(400, "No academy linked to this account");
  }

  const academyOid = asAcademyObjectId(academyId);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.limit) || 40));
  const skip = (page - 1) * limit;
  const q = String(query.q || "").trim();
  const actionList = parseActionFilter(query);

  const filter = { academy: academyOid };
  if (actionList?.length === 1) {
    filter.action = actionList[0];
  } else if (actionList?.length > 1) {
    filter.action = { $in: actionList };
  }
  if (q) {
    filter.$or = [
      { summary: { $regex: q, $options: "i" } },
      { actorName: { $regex: q, $options: "i" } },
      { actorEmail: { $regex: q, $options: "i" } },
    ];
  }

  const wantCounts = query.counts === "1" || query.counts === "true";

  const listPromise = Promise.all([
    AccountActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AccountActivity.countDocuments(filter),
  ]);

  const countsPromise = wantCounts
    ? AccountActivity.aggregate([
        { $match: { academy: academyOid } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
      ])
    : Promise.resolve(null);

  const [[items, total], countRows] = await Promise.all([
    listPromise,
    countsPromise,
  ]);

  const countsByAction = {};
  if (countRows) {
    for (const row of countRows) {
      if (row?._id) countsByAction[row._id] = row.count;
    }
  }

  return {
    activities: items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    actions: ACTIVITY_ACTIONS,
    ...(wantCounts ? { countsByAction } : {}),
  };
}

/** Client-reported events (e.g. print). Server-only actions are rejected. */
export async function createClientActivity(user, academyId, body = {}) {
  const action = String(body.action || "").trim().toUpperCase();
  const summary = String(body.summary || "").trim();
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

  if (!ACTIVITY_ACTIONS.includes(action)) {
    throw httpError(400, "Invalid activity action");
  }
  if (summary.length < 2) {
    throw httpError(400, "Activity summary is required");
  }
  if (!CLIENT_ALLOWED.has(action)) {
    throw httpError(403, "This activity must be logged by the server");
  }

  const row = await logActivity({
    user,
    academyId,
    action,
    summary,
    meta,
  });

  return row;
}

export { logActivity, ACTIVITY_ACTIONS };
