import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { enrichmentLogStorage } from "../storage/enrichmentLogStorage.js";

const router = Router();

router.get("/api/knowledge/enrichment-logs", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { action, productStandard, triggerRunId, limit, offset, since } = req.query;

    const filters: {
      action?: string;
      productStandard?: string;
      triggerRunId?: string;
      since?: Date;
      limit?: number;
      offset?: number;
    } = {};

    if (action && typeof action === "string") {
      filters.action = action;
    }

    if (productStandard && typeof productStandard === "string") {
      filters.productStandard = productStandard;
    }

    if (triggerRunId && typeof triggerRunId === "string") {
      filters.triggerRunId = triggerRunId;
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

    const logs = await enrichmentLogStorage.getAll(filters);
    res.json(logs);
  } catch (error: any) {
    console.error("[API] Error fetching enrichment logs:", error);
    res.status(500).json({ error: "Failed to fetch enrichment logs" });
  }
});

router.get("/api/knowledge/enrichment-logs/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { productStandard, since } = req.query;
    
    const filters: { productStandard?: string; since?: Date } = {};
    
    if (productStandard && typeof productStandard === "string") {
      filters.productStandard = productStandard;
    }
    
    if (since && typeof since === "string") {
      filters.since = new Date(since);
    }
    
    const stats = await enrichmentLogStorage.getStats(filters);
    res.json(stats);
  } catch (error: any) {
    console.error("[API] Error fetching enrichment logs stats:", error);
    res.status(500).json({ error: "Failed to fetch enrichment logs stats" });
  }
});

router.get("/api/knowledge/enrichment-logs/intent/:intentId", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const intentId = parseInt(req.params.intentId, 10);
    
    if (isNaN(intentId)) {
      return res.status(400).json({ error: "Invalid intent ID" });
    }
    
    const logs = await enrichmentLogStorage.getByIntentId(intentId);
    res.json(logs);
  } catch (error: any) {
    console.error("[API] Error fetching enrichment logs by intent:", error);
    res.status(500).json({ error: "Failed to fetch enrichment logs" });
  }
});

router.get("/api/knowledge/enrichment-logs/run/:triggerRunId", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { triggerRunId } = req.params;
    
    const logs = await enrichmentLogStorage.getByTriggerRunId(triggerRunId);
    res.json(logs);
  } catch (error: any) {
    console.error("[API] Error fetching enrichment logs by run:", error);
    res.status(500).json({ error: "Failed to fetch enrichment logs" });
  }
});

export default router;
