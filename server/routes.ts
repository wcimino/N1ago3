import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";

export const router = Router();

function verifyWebhookSignature(
  payloadBody: Buffer,
  signature: string | undefined,
  secret: string | undefined
): { isValid: boolean; errorMessage?: string } {
  if (!secret) {
    return { isValid: true };
  }
  
  if (!signature) {
    return { 
      isValid: false, 
      errorMessage: "Assinatura ausente - header X-Smooch-Signature ou X-Zendesk-Webhook-Signature não encontrado" 
    };
  }
  
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadBody)
    .digest("hex");
  
  const isValid = crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
  
  if (isValid) {
    return { isValid: true };
  }
  
  return { isValid: false, errorMessage: "Assinatura inválida" };
}

router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "N1ago",
  });
});

router.post("/webhook/zendesk", async (req: Request, res: Response) => {
  const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const rawBody = rawBodyBuffer.toString();
  const sourceIp = req.ip || req.socket.remoteAddress || "unknown";
  const headersDict = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, String(v)])
  );

  const logEntry = await storage.createWebhookLog({
    sourceIp,
    headers: headersDict,
    payload: req.body,
    rawBody,
    processingStatus: "pending",
  });

  console.log(`Webhook registrado - Log ID: ${logEntry.id}`);

  try {
    const webhookSecret = process.env.ZENDESK_WEBHOOK_SECRET;
    const signature =
      (req.headers["x-smooch-signature"] as string) ||
      (req.headers["x-zendesk-webhook-signature"] as string);

    const { isValid, errorMessage } = verifyWebhookSignature(
      rawBodyBuffer,
      signature,
      webhookSecret
    );

    if (!isValid) {
      await storage.updateWebhookLogStatus(logEntry.id, "error", errorMessage);
      return res.status(401).json({ status: "error", message: errorMessage });
    }

    const events = req.body.events || [];

    if (!events.length) {
      await storage.updateWebhookLogStatus(logEntry.id, "success", "Nenhum evento para processar");
      return res.json({ status: "ok", message: "No events" });
    }

    let processedCount = 0;

    for (const event of events) {
      const eventType = event.type;
      const eventPayload = event.payload || {};

      if (eventType === "conversation:message" || eventType === "message") {
        const conversationData = eventPayload.conversation || req.body.conversation || {};
        const zendeskConversationId = conversationData.id;
        const zendeskAppId = req.body.app?.id;

        if (zendeskConversationId) {
          const userData = eventPayload.user || req.body.user;
          const conversation = await storage.getOrCreateConversation(
            zendeskConversationId,
            zendeskAppId,
            userData
          );

          let messages = eventPayload.messages || [];
          if (!messages.length && eventPayload.message) {
            messages = [eventPayload.message];
          }

          for (const msg of messages) {
            await storage.saveMessage(conversation.id, msg, logEntry.id);
            processedCount++;
            console.log(
              `Mensagem salva - Conversa: ${zendeskConversationId}, Autor: ${msg.author?.type}`
            );
          }
        }
      } else if (eventType === "conversation:create") {
        const conversationData = eventPayload.conversation || {};
        const zendeskConversationId = conversationData.id;
        const zendeskAppId = req.body.app?.id;

        if (zendeskConversationId) {
          const userData = eventPayload.user;
          await storage.getOrCreateConversation(zendeskConversationId, zendeskAppId, userData);
          processedCount++;
          console.log(`Conversa criada: ${zendeskConversationId}`);
        }
      }
    }

    await storage.updateWebhookLogStatus(logEntry.id, "success");
    return res.json({
      status: "success",
      log_id: logEntry.id,
      events_processed: processedCount,
    });
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`Erro ao processar webhook: ${errorMsg}`);
    await storage.updateWebhookLogStatus(logEntry.id, "error", errorMsg);
    return res.status(500).json({
      status: "error",
      message: errorMsg,
      log_id: logEntry.id,
    });
  }
});

router.get("/api/webhook-logs", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { logs, total } = await storage.getWebhookLogs(limit, offset, status);

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

router.get("/api/webhook-logs/stats", async (req: Request, res: Response) => {
  const stats = await storage.getWebhookLogsStats();
  res.json({
    total: stats.total,
    by_status: stats.byStatus,
  });
});

router.get("/api/webhook-logs/:id", async (req: Request, res: Response) => {
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

router.get("/api/conversations", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { conversations, total } = await storage.getConversations(limit, offset);

  res.json({
    total,
    offset,
    limit,
    conversations: conversations.map((conv) => ({
      id: conv.id,
      zendesk_conversation_id: conv.zendeskConversationId,
      zendesk_app_id: conv.zendeskAppId,
      user_id: conv.userId,
      status: conv.status,
      created_at: conv.createdAt?.toISOString(),
      updated_at: conv.updatedAt?.toISOString(),
    })),
  });
});

router.get("/api/conversations/:zendeskId/messages", async (req: Request, res: Response) => {
  const result = await storage.getConversationMessages(req.params.zendeskId);

  if (!result) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json({
    conversation_id: result.conversation.zendeskConversationId,
    messages: result.messages.map((msg) => ({
      id: msg.id,
      author_type: msg.authorType,
      author_name: msg.authorName,
      content_type: msg.contentType,
      content_text: msg.contentText,
      received_at: msg.receivedAt?.toISOString(),
      zendesk_timestamp: msg.zendeskTimestamp?.toISOString(),
    })),
  });
});
