import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";

const router = Router();

router.get("/api/webhook-logs", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const sunshineId = req.query.user as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { logs, total } = await storage.getWebhookLogs(limit, offset, status, sunshineId);

  res.json({
    total,
    offset,
    limit,
    logs: logs.map((log) => ({
      id: log.id,
      received_at: log.receivedAt?.toISOString(),
      source_ip: log.sourceIp,
      processing_status: log.processingStatus,
      error_message: log.errorMessage,
      processed_at: log.processedAt?.toISOString(),
    })),
  });
});

router.get("/api/webhook-logs/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getWebhookLogsStats();
  res.json({
    total: stats.total,
    by_status: stats.byStatus,
  });
});

router.get("/api/webhook-logs/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const log = await storage.getWebhookLogById(id);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.json({
    id: log.id,
    received_at: log.receivedAt?.toISOString(),
    source_ip: log.sourceIp,
    headers: log.headers,
    payload: log.payload,
    raw_body: log.rawBody,
    processing_status: log.processingStatus,
    error_message: log.errorMessage,
    processed_at: log.processedAt?.toISOString(),
  });
});

export default router;
