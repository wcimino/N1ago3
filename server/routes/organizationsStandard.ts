import { Router } from "express";
import { organizationsStandardStorage } from "../storage/organizationsStandardStorage.js";
import { requireAuthorizedUser } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuthorizedUser, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const { organizations, total } = await organizationsStandardStorage.getAllOrganizations(limit, offset);
    
    res.json({
      organizations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:cnpjRoot", requireAuthorizedUser, async (req, res, next) => {
  try {
    const org = await organizationsStandardStorage.getOrganizationByCnpjRoot(req.params.cnpjRoot);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const usersCount = await organizationsStandardStorage.getUsersByOrganization(req.params.cnpjRoot);
    
    res.json({ ...org, usersCount });
  } catch (error) {
    next(error);
  }
});

router.get("/:cnpjRoot/history", requireAuthorizedUser, async (req, res, next) => {
  try {
    const history = await organizationsStandardStorage.getOrganizationHistory(req.params.cnpjRoot);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
