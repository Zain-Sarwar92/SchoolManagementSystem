import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { activityService } from "../services/generator/index.js";

export const listAccountActivities = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const result = await activityService.listActivities(academyId, req.query);
  res.json({ success: true, ...result });
});

/** Client-reported events (e.g. print from browser tab). */
export const createAccountActivity = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const row = await activityService.createClientActivity(
    req.user,
    academyId,
    req.body || {}
  );
  res.status(201).json({ success: true, activity: row });
});
