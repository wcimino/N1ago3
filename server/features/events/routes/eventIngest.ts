import { Router, type Request, type Response } from "express";
import {
  extractRequestContext,
  validateApiKey,
  validateEventPayload,
  authorizeSource,
  checkAndApplyRateLimit,
  saveEvent,
  logSuccess,
  logError,
  logValidationError,
  logRateLimitExceeded,
  logBatchResult,
  MAX_BATCH_SIZE,
} from "../services/ingestService.js";

const router = Router();

router.post("/api/events/ingest", async (req: Request, res: Response) => {
  const ctx = extractRequestContext(req, "/api/events/ingest");

  try {
    const apiKeyResult = await validateApiKey(ctx, "ingest_single");
    if (!apiKeyResult.valid) {
      return res.status(apiKeyResult.response.status).json(apiKeyResult.response.body);
    }

    const payloadResult = validateEventPayload(req.body);
    if (!payloadResult.valid) {
      await logValidationError(ctx, "ingest_single", payloadResult.errors, req.body?.source, req.body?.channel_type);
      return res.status(400).json({ error: "Dados inválidos", details: payloadResult.errors });
    }

    const eventData = payloadResult.data;
    const authResult = await authorizeSource(ctx, eventData.source, eventData.channel_type, "ingest_single");
    if (!authResult.authorized) {
      return res.status(authResult.error!.status).json(authResult.error);
    }

    const rateLimitResult = checkAndApplyRateLimit(res, authResult.sourceId!, 1);
    if (!rateLimitResult.allowed) {
      await logRateLimitExceeded(ctx, authResult.sourceId!, eventData.source, eventData.channel_type, 1);
      return res.status(rateLimitResult.error!.status).json(rateLimitResult.error);
    }

    const { event, isNew } = await saveEvent(eventData);
    await logSuccess(ctx, authResult.sourceId!, eventData.source, eventData.channel_type, 1, isNew);

    res.status(isNew ? 201 : 200).json({
      success: true,
      event_id: event.id,
      is_new: isNew,
      message: isNew ? "Evento criado com sucesso" : "Evento já existia (duplicado)",
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting event:", error);
    await logError(ctx, "ingest_error", error.message, req.body?.source, req.body?.channel_type);
    res.status(500).json({ error: "Erro interno ao processar evento", details: error.message });
  }
});

router.post("/api/events/ingest/batch", async (req: Request, res: Response) => {
  const ctx = extractRequestContext(req, "/api/events/ingest/batch");

  try {
    const apiKeyResult = await validateApiKey(ctx, "ingest_batch");
    if (!apiKeyResult.valid) {
      return res.status(apiKeyResult.response.status).json(apiKeyResult.response.body);
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      await logValidationError(ctx, "ingest_batch", [{ field: "events", message: "O campo 'events' deve ser um array com pelo menos um evento" }]);
      return res.status(400).json({ error: "Dados inválidos", details: "O campo 'events' deve ser um array com pelo menos um evento" });
    }

    if (events.length > MAX_BATCH_SIZE) {
      await logValidationError(ctx, "ingest_batch", [{ field: "events", message: `Máximo de ${MAX_BATCH_SIZE} eventos por requisição` }]);
      return res.status(400).json({ error: "Limite excedido", details: `Máximo de ${MAX_BATCH_SIZE} eventos por requisição` });
    }

    const firstEvent = events[0];
    const firstPayloadResult = validateEventPayload(firstEvent);
    if (firstPayloadResult.valid) {
      const authResult = await authorizeSource(ctx, firstPayloadResult.data.source, firstPayloadResult.data.channel_type, "ingest_batch");
      if (authResult.authorized && authResult.sourceId) {
        const rateLimitResult = checkAndApplyRateLimit(res, authResult.sourceId, events.length);
        if (!rateLimitResult.allowed) {
          await logRateLimitExceeded(ctx, authResult.sourceId, firstPayloadResult.data.source, firstPayloadResult.data.channel_type, events.length);
          return res.status(rateLimitResult.error!.status).json({
            ...rateLimitResult.error,
            details: `${rateLimitResult.error!.details}. Batch de ${events.length} eventos excederia o limite.`,
          });
        }
      }
    }

    const results: Array<{ index: number; success: boolean; event_id?: number; error?: string }> = [];

    for (let i = 0; i < events.length; i++) {
      const payloadResult = validateEventPayload(events[i]);
      if (!payloadResult.valid) {
        results.push({ index: i, success: false, error: payloadResult.errors.map((e) => e.message).join(", ") });
        continue;
      }

      const eventData = payloadResult.data;
      const authResult = await authorizeSource(ctx, eventData.source, eventData.channel_type, "ingest_batch");
      if (!authResult.authorized) {
        results.push({ index: i, success: false, error: authResult.error?.details });
        continue;
      }

      try {
        const { event } = await saveEvent(eventData);
        results.push({ index: i, success: true, event_id: event.id });
      } catch (error: any) {
        results.push({ index: i, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await logBatchResult(ctx, events.length, failCount, firstEvent?.source, firstEvent?.channel_type);

    res.status(200).json({
      success: failCount === 0,
      total: events.length,
      created: successCount,
      failed: failCount,
      results,
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting batch:", error);
    await logError(ctx, "ingest_batch_error", error.message);
    res.status(500).json({ error: "Erro interno ao processar eventos", details: error.message });
  }
});

export default router;
