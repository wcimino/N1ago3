import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import { learningAttemptsStorage } from "../storage/learningAttemptsStorage.js";
import type { LearningAttemptResult } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/learning-attempts", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { result, limit, offset, since } = req.query;

    const filters: {
      result?: LearningAttemptResult;
      since?: Date;
      limit?: number;
      offset?: number;
    } = {};

    if (result && typeof result === "string") {
      filters.result = result as LearningAttemptResult;
    }

    if (since && typeof since === "string") {
      filters.since = new Date(since);
    }

    if (limit && typeof limit === "string") {
      filters.limit = parseInt(limit, 10);
    }

    if (offset && typeof offset === "string") {
      filters.offset = parseInt(offset, 10);
    }

    const attempts = await learningAttemptsStorage.getAll(filters);
    res.json(attempts);
  } catch (error: any) {
    console.error("[API] Error fetching learning attempts:", error);
    res.status(500).json({ error: "Failed to fetch learning attempts" });
  }
});

router.get("/api/knowledge/learning-attempts/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { since } = req.query;
    const sinceDate = since && typeof since === "string" ? new Date(since) : undefined;
    
    const stats = await learningAttemptsStorage.getStats(sinceDate);
    res.json(stats);
  } catch (error: any) {
    console.error("[API] Error fetching learning attempts stats:", error);
    res.status(500).json({ error: "Failed to fetch learning attempts stats" });
  }
});

export default router;
