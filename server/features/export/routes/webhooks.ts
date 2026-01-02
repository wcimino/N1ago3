import { Router, type Request, type Response } from "express";
import { webhookStorage } from "../storage/webhookStorage.js";
import { getAdapter } from "../../events/adapters/index.js";
import { eventBus, EVENTS } from "../../events/services/eventBus.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "N1ago",
  });
});

router.post("/webhook/zendesk", async (req: Request, res: Response) => {
  const source = "zendesk";
  const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const rawBody = rawBodyBuffer.toString();
  const sourceIp = req.ip || req.socket.remoteAddress || "unknown";
  const headersDict = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, String(v)])
  );

  try {
    const adapter = getAdapter(source);
    if (!adapter) {
      return res.status(500).json({ status: "error", message: `No adapter for source: ${source}` });
    }

    const webhookSecret = process.env.ZENDESK_WEBHOOK_SECRET;
    const { isValid, errorMessage } = adapter.verifyAuth(rawBodyBuffer, headersDict, webhookSecret);

    if (!isValid) {
      console.log(`[Webhook] Auth failed: ${errorMessage}`);
      return res.status(401).json({ status: "error", message: errorMessage });
    }

    const rawEntry = await webhookStorage.createWebhookLog({
      sourceIp,
      headers: headersDict,
      payload: req.body,
      rawBody,
      processingStatus: "processing",
    });

    console.log(`[Webhook] Received - Raw ID: ${rawEntry.id}, Source: ${source}`);

    eventBus.emit(EVENTS.RAW_CREATED, { rawId: rawEntry.id, source, skipStatusCheck: true });

    return res.json({
      status: "received",
      raw_id: rawEntry.id,
    });
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[Webhook] Error receiving: ${errorMsg}`);
    return res.status(500).json({
      status: "error",
      message: errorMsg,
    });
  }
});

export default router;
