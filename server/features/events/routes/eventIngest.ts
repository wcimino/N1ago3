import { Router, type Request, type Response } from "express";
import { externalEventSourcesStorage } from "../storage/externalEventSourcesStorage.js";
import { eventStorage } from "../storage/eventStorage.js";
import { z } from "zod";

const router = Router();

const eventIngestSchema = z.object({
  event_type: z.string().min(1, "event_type é obrigatório"),
  event_subtype: z.string().optional(),
  source: z.string().min(1, "source é obrigatório"),
  source_event_id: z.string().optional(),
  external_conversation_id: z.string().optional(),
  external_user_id: z.string().optional(),
  author_type: z.enum(["customer", "agent", "system", "bot"], {
    errorMap: () => ({ message: "author_type deve ser: customer, agent, system ou bot" }),
  }),
  author_id: z.string().optional(),
  author_name: z.string().optional(),
  content_text: z.string().optional(),
  content_payload: z.any().optional(),
  occurred_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "occurred_at deve ser uma data válida em formato ISO 8601",
  }),
  metadata: z.any().optional(),
  channel_type: z.string().min(1, "channel_type é obrigatório"),
});

router.post("/api/events/ingest", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
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
      return res.status(400).json({ 
        error: "Dados inválidos",
        details: errors,
      });
    }

    const eventData = parseResult.data;

    const validation = await externalEventSourcesStorage.validateApiKeyAndSource(apiKey, eventData.source, eventData.channel_type);
    
    if (!validation.valid) {
      return res.status(403).json({ 
        error: "Acesso negado",
        details: validation.reason,
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

    res.status(isNew ? 201 : 200).json({
      success: true,
      event_id: event.id,
      is_new: isNew,
      message: isNew ? "Evento criado com sucesso" : "Evento já existia (duplicado)",
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting event:", error);
    res.status(500).json({ 
      error: "Erro interno ao processar evento",
      details: error.message,
    });
  }
});

router.post("/api/events/ingest/batch", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(401).json({ 
        error: "API key não fornecida",
        details: "Inclua o header 'X-API-Key' com sua chave de API",
      });
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        error: "Dados inválidos",
        details: "O campo 'events' deve ser um array com pelo menos um evento",
      });
    }

    if (events.length > 100) {
      return res.status(400).json({ 
        error: "Limite excedido",
        details: "Máximo de 100 eventos por requisição",
      });
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

    res.status(200).json({
      success: failCount === 0,
      total: events.length,
      created: successCount,
      failed: failCount,
      results,
    });
  } catch (error: any) {
    console.error("[EventIngest] Error ingesting batch:", error);
    res.status(500).json({ 
      error: "Erro interno ao processar eventos",
      details: error.message,
    });
  }
});

export default router;
