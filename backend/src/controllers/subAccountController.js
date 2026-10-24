import { asyncHandler, getAcademyId } from "../utils/helpers.js";
import { subAccountService } from "../services/generator/index.js";

export const listSubAccounts = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const includeInactive = req.query.includeInactive !== "0";
  const subAccounts = await subAccountService.listSubAccounts(academyId, {
    includeInactive,
  });
  res.json({ success: true, subAccounts });
});

export const createSubAccount = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const subAccount = await subAccountService.createSubAccount(
    req.user,
    academyId,
    req.body || {}
  );
  res.status(201).json({ success: true, subAccount });
});

export const updateSubAccount = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  const subAccount = await subAccountService.updateSubAccount(
    req.user,
    academyId,
    req.params.id,
    req.body || {}
  );
  res.json({ success: true, subAccount });
});

export const deleteSubAccount = asyncHandler(async (req, res) => {
  const academyId = getAcademyId(req.user);
  await subAccountService.deleteSubAccount(
    req.user,
    academyId,
    req.params.id
  );
  res.json({ success: true, message: "Sub account deleted" });
});
