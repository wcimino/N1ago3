import { Router, type Request, type Response } from "express";
import { externalEventSourcesStorage } from "../storage/externalEventSourcesStorage.js";
import { eventStorage } from "../storage/eventStorage.js";
import { auditLogsStorage } from "../storage/auditLogsStorage.js";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "../services/rateLimiter.js";
import { z } from "zod";

const router = Router();

const MAX_STRING_LENGTH = 128;
const MAX_CONTENT_TEXT_LENGTH = 10000;
const MAX_DAYS_WINDOW = 30;

const eventIngestSchema = z.object({
  event_type: z.string().min(1, "event_type é obrigatório").max(MAX_STRING_LENGTH, `event_type deve ter no máximo ${MAX_STRING_LENGTH} caracteres`),
  event_subtype: z.string().max(MAX_STRING_LENGTH, `event_subtype deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  source: z.string().min(1, "source é obrigatório").max(MAX_STRING_LENGTH, `source deve ter no máximo ${MAX_STRING_LENGTH} caracteres`),
  source_event_id: z.string().max(MAX_STRING_LENGTH, `source_event_id deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  external_conversation_id: z.string().max(MAX_STRING_LENGTH, `external_conversation_id deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  external_user_id: z.string().max(MAX_STRING_LENGTH, `external_user_id deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  author_type: z.enum(["customer", "agent", "system", "bot"], {
    errorMap: () => ({ message: "author_type deve ser: customer, agent, system ou bot" }),
  }),
  author_id: z.string().max(MAX_STRING_LENGTH, `author_id deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  author_name: z.string().max(MAX_STRING_LENGTH, `author_name deve ter no máximo ${MAX_STRING_LENGTH} caracteres`).optional(),
  content_text: z.string().max(MAX_CONTENT_TEXT_LENGTH, `content_text deve ter no máximo ${MAX_CONTENT_TEXT_LENGTH} caracteres`).optional(),
  content_payload: z.record(z.any()).optional(),
  occurred_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "occurred_at deve ser uma data válida em formato ISO 8601",
  }).refine((val) => {
    const eventDate = new Date(val);
    const now = new Date();
    const minDate = new Date(now.getTime() - MAX_DAYS_WINDOW * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + MAX_DAYS_WINDOW * 24 * 60 * 60 * 1000);
    return eventDate >= minDate && eventDate <= maxDate;
  }, {
    message: `occurred_at deve estar dentro de ±${MAX_DAYS_WINDOW} dias da data atual`,
  }),
  metadata: z.record(z.any()).optional(),
  channel_type: z.string().min(1, "channel_type é obrigatório").max(MAX_STRING_LENGTH, `channel_type deve ter no máximo ${MAX_STRING_LENGTH} caracteres`),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

router.post("/api/events/ingest", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const apiKey = req.headers["x-api-key"] as string;
  const apiKeyPrefix = auditLogsStorage.getApiKeyPrefix(apiKey || "");
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";

  try {
    if (!apiKey) {
      await auditLogsStorage.log({
        apiKeyPrefix: "none",
        action: "ingest_single",
        endpoint: "/api/events/ingest",
        statusCode: 401,
        errorMessage: "API key não fornecida",
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(401).json({ 
        error: "API key não fornecida",
        details: "Inclua o header 'X-API-Key' com sua chave de API",
      });
    }

    const parseResult = eventIngestSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      await auditLogsStorage.log({
        apiKeyPrefix,
        action: "ingest_single",
        endpoint: "/api/events/ingest",
        statusCode: 400,
        errorMessage: `Validação: ${errors.map(e => e.message).join(", ")}`,
        requestSource: req.body?.source,
        requestChannelType: req.body?.channel_type,
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(400).json({ 
        error: "Dados inválidos",
        details: errors,
      });
    }

    const eventData = parseResult.data;

    const validation = await externalEventSourcesStorage.validateApiKeyAndSource(apiKey, eventData.source, eventData.channel_type);
    
    if (!validation.valid) {
      await auditLogsStorage.log({
        apiKeyPrefix,
        action: "ingest_single",
        endpoint: "/api/events/ingest",
        statusCode: 403,
        errorMessage: validation.reason,
        requestSource: eventData.source,
        requestChannelType: eventData.channel_type,
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(403).json({ 
        error: "Acesso negado",
        details: validation.reason,
      });
    }

    const rateLimitResult = checkRateLimit(validation.sourceId!, 1);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      res.setHeader(key, value);
    }

    if (!rateLimitResult.allowed) {
      await auditLogsStorage.log({
        sourceId: validation.sourceId,
        apiKeyPrefix,
        action: "rate_limit_exceeded",
        endpoint: "/api/events/ingest",
        statusCode: 429,
        errorMessage: `Rate limit excedido: ${RATE_LIMITS.MINUTE_LIMIT}/min, ${RATE_LIMITS.HOUR_LIMIT}/hora`,
        requestSource: eventData.source,
        requestChannelType: eventData.channel_type,
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(429).json({ 
        error: "Rate limit excedido",
        details: `Limite: ${RATE_LIMITS.MINUTE_LIMIT} requisições/minuto, ${RATE_LIMITS.HOUR_LIMIT} requisições/hora`,
        retry_after: rateLimitResult.retryAfter,
      });
    }

    const { event, isNew } = await eventStorage.saveStandardEvent({
      eventType: eventData.event_type,
      eventSubtype: eventData.event_subtype,
      source: eventData.source,
      sourceEventId: eventData.source_event_id,
      externalConversationId: eventData.external_conversation_id,
      externalUserId: eventData.external_user_id,
      authorType: eventData.author_type,
      authorId: eventData.author_id,
      authorName: eventData.author_name,
      contentText: eventData.content_text,
      contentPayload: eventData.content_payload,
      occurredAt: new Date(eventData.occurred_at),
      metadata: eventData.metadata,
      channelType: eventData.channel_type,
    });

    await auditLogsStorage.log({
      sourceId: validation.sourceId,
      apiKeyPrefix,
      action: "ingest_success",
      endpoint: "/api/events/ingest",
      eventCount: 1,
      statusCode: isNew ? 201 : 200,
      requestSource: eventData.source,
      requestChannelType: eventData.channel_type,
      ipAddress,
      userAgent,
      durationMs: Date.now() - startTime,
    });

    res.status(isNew ? 201 : 200).json({
      success: true,
      event_id: event.id,
      is_new: isNew,
      message: isNew ? "Evento criado com sucesso" : "Evento já existia (duplicado)",
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting event:", error);
    await auditLogsStorage.log({
      apiKeyPrefix,
      action: "ingest_error",
      endpoint: "/api/events/ingest",
      statusCode: 500,
      errorMessage: error.message,
      requestSource: req.body?.source,
      requestChannelType: req.body?.channel_type,
      ipAddress,
      userAgent,
      durationMs: Date.now() - startTime,
    });
    res.status(500).json({ 
      error: "Erro interno ao processar evento",
      details: error.message,
    });
  }
});

router.post("/api/events/ingest/batch", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const apiKey = req.headers["x-api-key"] as string;
  const apiKeyPrefix = auditLogsStorage.getApiKeyPrefix(apiKey || "");
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";

  try {
    if (!apiKey) {
      await auditLogsStorage.log({
        apiKeyPrefix: "none",
        action: "ingest_batch",
        endpoint: "/api/events/ingest/batch",
        statusCode: 401,
        errorMessage: "API key não fornecida",
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(401).json({ 
        error: "API key não fornecida",
        details: "Inclua o header 'X-API-Key' com sua chave de API",
      });
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      await auditLogsStorage.log({
        apiKeyPrefix,
        action: "ingest_batch",
        endpoint: "/api/events/ingest/batch",
        statusCode: 400,
        errorMessage: "O campo 'events' deve ser um array com pelo menos um evento",
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(400).json({ 
        error: "Dados inválidos",
        details: "O campo 'events' deve ser um array com pelo menos um evento",
      });
    }

    if (events.length > 100) {
      await auditLogsStorage.log({
        apiKeyPrefix,
        action: "ingest_batch",
        endpoint: "/api/events/ingest/batch",
        eventCount: events.length,
        statusCode: 400,
        errorMessage: "Máximo de 100 eventos por requisição",
        ipAddress,
        userAgent,
        durationMs: Date.now() - startTime,
      });
      return res.status(400).json({ 
        error: "Limite excedido",
        details: "Máximo de 100 eventos por requisição",
      });
    }

    const firstEvent = events[0];
    const firstParse = eventIngestSchema.safeParse(firstEvent);
    if (firstParse.success) {
      const validation = await externalEventSourcesStorage.validateApiKeyAndSource(
        apiKey, 
        firstParse.data.source, 
        firstParse.data.channel_type
      );
      
      if (validation.valid && validation.sourceId) {
        const rateLimitResult = checkRateLimit(validation.sourceId, events.length);
        const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
        
        for (const [key, value] of Object.entries(rateLimitHeaders)) {
          res.setHeader(key, value);
        }

        if (!rateLimitResult.allowed) {
          await auditLogsStorage.log({
            sourceId: validation.sourceId,
            apiKeyPrefix,
            action: "rate_limit_exceeded",
            endpoint: "/api/events/ingest/batch",
            eventCount: events.length,
            statusCode: 429,
            errorMessage: `Rate limit excedido para batch de ${events.length} eventos`,
            requestSource: firstParse.data.source,
            requestChannelType: firstParse.data.channel_type,
            ipAddress,
            userAgent,
            durationMs: Date.now() - startTime,
          });
          return res.status(429).json({ 
            error: "Rate limit excedido",
            details: `Limite: ${RATE_LIMITS.MINUTE_LIMIT} requisições/minuto, ${RATE_LIMITS.HOUR_LIMIT} requisições/hora. Batch de ${events.length} eventos excederia o limite.`,
            retry_after: rateLimitResult.retryAfter,
          });
        }
      }
    }

    const results: Array<{ index: number; success: boolean; event_id?: number; error?: string }> = [];

    for (let i = 0; i < events.length; i++) {
      const parseResult = eventIngestSchema.safeParse(events[i]);
      
      if (!parseResult.success) {
        results.push({
          index: i,
          success: false,
          error: parseResult.error.errors.map((e) => e.message).join(", "),
        });
        continue;
      }

      const eventData = parseResult.data;

      const validation = await externalEventSourcesStorage.validateApiKeyAndSource(apiKey, eventData.source, eventData.channel_type);
      if (!validation.valid) {
        results.push({
          index: i,
          success: false,
          error: validation.reason,
        });
        continue;
      }

      try {
        const { event, isNew } = await eventStorage.saveStandardEvent({
          eventType: eventData.event_type,
          eventSubtype: eventData.event_subtype,
          source: eventData.source,
          sourceEventId: eventData.source_event_id,
          externalConversationId: eventData.external_conversation_id,
          externalUserId: eventData.external_user_id,
          authorType: eventData.author_type,
          authorId: eventData.author_id,
          authorName: eventData.author_name,
          contentText: eventData.content_text,
          contentPayload: eventData.content_payload,
          occurredAt: new Date(eventData.occurred_at),
          metadata: eventData.metadata,
          channelType: eventData.channel_type,
        });

        results.push({ index: i, success: true, event_id: event.id });
      } catch (error: any) {
        results.push({ index: i, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await auditLogsStorage.log({
      apiKeyPrefix,
      action: failCount === 0 ? "ingest_batch_success" : "ingest_batch_partial",
      endpoint: "/api/events/ingest/batch",
      eventCount: events.length,
      statusCode: 200,
      errorMessage: failCount > 0 ? `${failCount} de ${events.length} eventos falharam` : undefined,
      requestSource: firstEvent?.source,
      requestChannelType: firstEvent?.channel_type,
      ipAddress,
      userAgent,
      durationMs: Date.now() - startTime,
    });

    res.status(200).json({
      success: failCount === 0,
      total: events.length,
      created: successCount,
      failed: failCount,
      results,
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting batch:", error);
    await auditLogsStorage.log({
      apiKeyPrefix,
      action: "ingest_batch_error",
      endpoint: "/api/events/ingest/batch",
      statusCode: 500,
      errorMessage: error.message,
      ipAddress,
      userAgent,
      durationMs: Date.now() - startTime,
    });
    res.status(500).json({ 
      error: "Erro interno ao processar eventos",
      details: error.message,
    });
  }
});

export default router;
