import { Router } from "express";
import {
  listSubAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
} from "../controllers/subAccountController.js";

/**
 * Mounted under /generator/sub-accounts by generatorRoutes
 * (parent already applies protect + TEST_GENERATOR + academy_admin).
 * Separate from Academy Management /teachers.
 */
const router = Router();

router.get("/", listSubAccounts);
router.post("/", createSubAccount);
router.put("/:id", updateSubAccount);
router.delete("/:id", deleteSubAccount);

export default router;
