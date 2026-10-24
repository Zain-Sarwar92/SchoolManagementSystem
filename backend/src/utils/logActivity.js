import AccountActivity from "../models/AccountActivity.js";
import { getAcademyId } from "./helpers.js";

/**
 * Fire-and-forget activity log. Never throws to callers.
 */
export async function logActivity({
  user,
  academyId,
  action,
  summary,
  meta = {},
}) {
  try {
    const academy = academyId || getAcademyId(user);
    if (!academy || !action || !summary) return null;

    return await AccountActivity.create({
      academy,
      actor: user?._id || user?.id || null,
      actorName: user?.name || "",
      actorEmail: user?.email || "",
      actorRole: user?.role || "",
      action,
      summary: String(summary).slice(0, 500),
      meta: meta && typeof meta === "object" ? meta : {},
    });
  } catch (err) {
    console.error("[logActivity]", err?.message || err);
    return null;
  }
}
