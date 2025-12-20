import type { Request, Response } from "express";
import { z } from "zod";
import { externalEventSourcesStorage } from "../storage/externalEventSourcesStorage.js";
import { eventStorage } from "../storage/eventStorage.js";
import { auditLogsStorage } from "../storage/auditLogsStorage.js";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "./rateLimiter.js";

const MAX_STRING_LENGTH = 128;
const MAX_CONTENT_TEXT_LENGTH = 10000;
const MAX_DAYS_WINDOW = 30;
const MAX_BATCH_SIZE = 100;

export const eventIngestSchema = z.object({
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

export type EventIngestData = z.infer<typeof eventIngestSchema>;

export interface RequestContext {
  apiKey: string | undefined;
  apiKeyPrefix: string;
  ipAddress: string;
  userAgent: string;
  startTime: number;
  endpoint: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  sourceId?: number;
  error?: { status: number; error: string; details: string };
}

export interface RateLimitCheckResult {
  allowed: boolean;
  headers: Record<string, string | number>;
  error?: { status: number; error: string; details: string; retry_after: number };
}

export function extractRequestContext(req: Request, endpoint: string): RequestContext {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "unknown";

  return {
    apiKey,
    apiKeyPrefix: auditLogsStorage.getApiKeyPrefix(apiKey || ""),
    ipAddress,
    userAgent: req.headers["user-agent"] || "unknown",
    startTime: Date.now(),
    endpoint,
  };
}

export async function validateApiKey(
  ctx: RequestContext,
  action: string
): Promise<{ valid: true } | { valid: false; response: { status: number; body: object } }> {
  if (!ctx.apiKey) {
    await auditLogsStorage.log({
      apiKeyPrefix: "none",
      action,
      endpoint: ctx.endpoint,
      statusCode: 401,
      errorMessage: "API key não fornecida",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      durationMs: Date.now() - ctx.startTime,
    });
    return {
      valid: false,
      response: {
        status: 401,
        body: { error: "API key não fornecida", details: "Inclua o header 'X-API-Key' com sua chave de API" },
      },
    };
  }
  return { valid: true };
}

export function validateEventPayload(
  payload: unknown
): { valid: true; data: EventIngestData } | { valid: false; errors: Array<{ field: string; message: string }> } {
  const parseResult = eventIngestSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    };
  }
  return { valid: true, data: parseResult.data };
}

export async function authorizeSource(
  ctx: RequestContext,
  source: string,
  channelType: string,
  action: string
): Promise<AuthorizationResult> {
  const validation = await externalEventSourcesStorage.validateApiKeyAndSource(ctx.apiKey!, source, channelType);
  
  if (!validation.valid) {
    await auditLogsStorage.log({
      apiKeyPrefix: ctx.apiKeyPrefix,
      action,
      endpoint: ctx.endpoint,
      statusCode: 403,
      errorMessage: validation.reason,
      requestSource: source,
      requestChannelType: channelType,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      durationMs: Date.now() - ctx.startTime,
    });
    return {
      authorized: false,
      error: { status: 403, error: "Acesso negado", details: validation.reason! },
    };
  }
  
  return { authorized: true, sourceId: validation.sourceId };
}

export function checkAndApplyRateLimit(
  res: Response,
  sourceId: number,
  eventCount: number
): RateLimitCheckResult {
  const rateLimitResult = checkRateLimit(sourceId, eventCount);
  const headers = getRateLimitHeaders(rateLimitResult);
  
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      headers,
      error: {
        status: 429,
        error: "Rate limit excedido",
        details: `Limite: ${RATE_LIMITS.MINUTE_LIMIT} requisições/minuto, ${RATE_LIMITS.HOUR_LIMIT} requisições/hora`,
        retry_after: rateLimitResult.retryAfter ?? 0,
      },
    };
  }
  
  return { allowed: true, headers };
}

export async function logRateLimitExceeded(
  ctx: RequestContext,
  sourceId: number,
  source: string,
  channelType: string,
  eventCount: number
): Promise<void> {
  await auditLogsStorage.log({
    sourceId,
    apiKeyPrefix: ctx.apiKeyPrefix,
    action: "rate_limit_exceeded",
    endpoint: ctx.endpoint,
    eventCount,
    statusCode: 429,
    errorMessage: `Rate limit excedido: ${RATE_LIMITS.MINUTE_LIMIT}/min, ${RATE_LIMITS.HOUR_LIMIT}/hora`,
    requestSource: source,
    requestChannelType: channelType,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    durationMs: Date.now() - ctx.startTime,
  });
}

export async function saveEvent(eventData: EventIngestData) {
  return eventStorage.saveStandardEvent({
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
}

export async function logSuccess(
  ctx: RequestContext,
  sourceId: number,
  source: string,
  channelType: string,
  eventCount: number,
  isNew: boolean
): Promise<void> {
  await auditLogsStorage.log({
    sourceId,
    apiKeyPrefix: ctx.apiKeyPrefix,
    action: "ingest_success",
    endpoint: ctx.endpoint,
    eventCount,
    statusCode: isNew ? 201 : 200,
    requestSource: source,
    requestChannelType: channelType,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    durationMs: Date.now() - ctx.startTime,
  });
}

export async function logError(
  ctx: RequestContext,
  action: string,
  errorMessage: string,
  source?: string,
  channelType?: string
): Promise<void> {
  await auditLogsStorage.log({
    apiKeyPrefix: ctx.apiKeyPrefix,
    action,
    endpoint: ctx.endpoint,
    statusCode: 500,
    errorMessage,
    requestSource: source,
    requestChannelType: channelType,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    durationMs: Date.now() - ctx.startTime,
  });
}

export async function logValidationError(
  ctx: RequestContext,
  action: string,
  errors: Array<{ field: string; message: string }>,
  source?: string,
  channelType?: string
): Promise<void> {
  await auditLogsStorage.log({
    apiKeyPrefix: ctx.apiKeyPrefix,
    action,
    endpoint: ctx.endpoint,
    statusCode: 400,
    errorMessage: `Validação: ${errors.map(e => e.message).join(", ")}`,
    requestSource: source,
    requestChannelType: channelType,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    durationMs: Date.now() - ctx.startTime,
  });
}

export async function logBatchResult(
  ctx: RequestContext,
  totalEvents: number,
  failCount: number,
  source?: string,
  channelType?: string
): Promise<void> {
  await auditLogsStorage.log({
    apiKeyPrefix: ctx.apiKeyPrefix,
    action: failCount === 0 ? "ingest_batch_success" : "ingest_batch_partial",
    endpoint: ctx.endpoint,
    eventCount: totalEvents,
    statusCode: 200,
    errorMessage: failCount > 0 ? `${failCount} de ${totalEvents} eventos falharam` : undefined,
    requestSource: source,
    requestChannelType: channelType,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    durationMs: Date.now() - ctx.startTime,
  });
}

export { MAX_BATCH_SIZE, RATE_LIMITS };
