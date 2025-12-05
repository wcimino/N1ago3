import { Router, type Request, type Response, type Express } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { isAuthenticated, requireAuthorizedUser } from "./replitAuth";

const router = Router();

function verifyWebhookAuth(
  payloadBody: Buffer,
  headers: {
    signature?: string;
    apiKey?: string;
  },
  secret: string | undefined
): { isValid: boolean; errorMessage?: string } {
  if (!secret) {
    return { isValid: true };
  }
  
  if (headers.apiKey) {
    const isValid = headers.apiKey === secret;
    if (isValid) {
      return { isValid: true };
    }
    return { isValid: false, errorMessage: "x-api-key inválida" };
  }
  
  if (headers.signature) {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadBody)
      .digest("hex");
    
    const normalizedSignature = headers.signature.startsWith("sha256=") 
      ? headers.signature.slice(7) 
      : headers.signature;
    
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(normalizedSignature, "hex")
      );
      
      if (isValid) {
        return { isValid: true };
      }
    } catch {
    }
    
    return { isValid: false, errorMessage: "Assinatura HMAC inválida" };
  }
  
  return { 
    isValid: false, 
    errorMessage: "Autenticação ausente - header x-api-key, X-Smooch-Signature ou X-Zendesk-Webhook-Signature não encontrado" 
  };
}

// Public routes (no authentication required)
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
    const authHeaders = {
      apiKey: req.headers["x-api-key"] as string | undefined,
      signature: (req.headers["x-smooch-signature"] as string) ||
                 (req.headers["x-zendesk-webhook-signature"] as string),
    };

    const { isValid, errorMessage } = verifyWebhookAuth(
      rawBodyBuffer,
      authHeaders,
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

      const userData = eventPayload.user || 
                       eventPayload.activity?.author?.user || 
                       req.body.user;
      
      if (userData?.id) {
        const user = await storage.upsertUser(userData);
        if (user) {
          console.log(`User upsert - sunshineId: ${user.sunshineId}, authenticated: ${user.authenticated}`);
        }
      }

      if (eventType === "conversation:message" || eventType === "message") {
        const conversationData = eventPayload.conversation || req.body.conversation || {};
        const zendeskConversationId = conversationData.id;
        const zendeskAppId = req.body.app?.id;

        if (zendeskConversationId) {
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

// Auth routes
router.get('/api/auth/user', isAuthenticated, requireAuthorizedUser, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getAuthUser(userId);
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Authorized users management routes
router.get("/api/authorized-users", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const users = await storage.getAuthorizedUsers();
  res.json(users);
});

router.post("/api/authorized-users", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { email, name } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email é obrigatório" });
  }

  const emailLower = email.toLowerCase();
  if (!emailLower.endsWith("@ifood.com.br")) {
    return res.status(400).json({ error: "Email deve ser do domínio @ifood.com.br" });
  }

  try {
    const existingUser = await storage.isUserAuthorized(emailLower);
    if (existingUser) {
      return res.status(409).json({ error: "Usuário já cadastrado" });
    }

    const user = await storage.addAuthorizedUser({
      email: emailLower,
      name,
      createdBy: (req as any).user?.claims?.email,
    });
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/authorized-users/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await storage.removeAuthorizedUser(id);
  res.json({ success: true });
});

// Protected API routes
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

router.get("/api/conversations", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
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

router.get("/api/conversations/:zendeskId/messages", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
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

router.get("/api/users", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { users, total } = await storage.getUsers(limit, offset);

  res.json({
    total,
    offset,
    limit,
    users: users.map((user) => ({
      id: user.id,
      sunshine_id: user.sunshineId,
      external_id: user.externalId,
      authenticated: user.authenticated,
      profile: user.profile,
      first_seen_at: user.firstSeenAt?.toISOString(),
      last_seen_at: user.lastSeenAt?.toISOString(),
    })),
  });
});

router.get("/api/users/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getUsersStats();
  res.json(stats);
});

export function registerRoutes(app: Express) {
  app.use(router);
}
