import { Router } from "express";
import { storage } from "../../storage.js";
import { organizationsStandardStorage } from "../organizations/storage.js";
import { requireAuthorizedUser } from "../../core/middleware/auth.js";

const router = Router();

router.get("/", requireAuthorizedUser, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const { users, total } = await storage.getAllStandardUsers(limit, offset);
    
    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:email", requireAuthorizedUser, async (req, res, next) => {
  try {
    const user = await storage.getStandardUserByEmail(req.params.email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get("/:email/history", requireAuthorizedUser, async (req, res, next) => {
  try {
    const history = await storage.getUserHistory(req.params.email);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get("/:email/organizations", requireAuthorizedUser, async (req, res, next) => {
  try {
    const organizations = await organizationsStandardStorage.getOrganizationsByUser(req.params.email);
    res.json(organizations);
  } catch (error) {
    next(error);
  }
});

export default router;
