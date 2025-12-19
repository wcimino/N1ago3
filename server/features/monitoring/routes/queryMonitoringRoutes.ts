import { Router, Request, Response } from "express";
import {
  getQueryStats,
  getRecentSlowQueries,
  getQueryLogsSummary,
  clearQueryStats,
  setLoggingEnabled,
  setSlowQueryThreshold,
  setLogToConsole,
  getLoggingConfig,
  forceFlush,
} from "../../../services/queryLogger";

const router = Router();

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const orderBy = (req.query.orderBy as string) || "callCount";
    const limit = parseInt(req.query.limit as string) || 50;
    
    const stats = await getQueryStats({
      orderBy: orderBy as any,
      limit,
    });
    
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/slow-queries", async (req: Request, res: Response) => {
  try {
    const thresholdMs = parseInt(req.query.threshold as string) || 100;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const queries = await getRecentSlowQueries(thresholdMs, limit);
    
    res.json({ queries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const summary = await getQueryLogsSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = getLoggingConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/config", async (req: Request, res: Response) => {
  try {
    const { enabled, slowQueryThresholdMs, logToConsole } = req.body;
    
    if (typeof enabled === "boolean") {
      setLoggingEnabled(enabled);
    }
    if (typeof slowQueryThresholdMs === "number") {
      setSlowQueryThreshold(slowQueryThresholdMs);
    }
    if (typeof logToConsole === "boolean") {
      setLogToConsole(logToConsole);
    }
    
    const config = getLoggingConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/clear", async (req: Request, res: Response) => {
  try {
    await clearQueryStats();
    res.json({ success: true, message: "Query stats cleared" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/flush", async (req: Request, res: Response) => {
  try {
    await forceFlush();
    res.json({ success: true, message: "Logs flushed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
