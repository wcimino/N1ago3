import { Router, type Request, type Response, type Express } from "express";
import { storage } from "./storage.js";
import { isAuthenticated, requireAuthorizedUser } from "./replitAuth.js";
import { getAdapter } from "./adapters/index.js";
import { eventBus, EVENTS } from "./services/eventBus.js";

const router = Router();

// Public routes (no authentication required)
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
      console.log(`Webhook auth failed: ${errorMessage}`);
      return res.status(401).json({ status: "error", message: errorMessage });
    }

    const rawEntry = await storage.createWebhookLog({
      sourceIp,
      headers: headersDict,
      payload: req.body,
      rawBody,
      processingStatus: "pending",
    });

    console.log(`Webhook received - Raw ID: ${rawEntry.id}, Source: ${source}`);

    eventBus.emit(EVENTS.RAW_CREATED, { rawId: rawEntry.id, source });

    return res.json({
      status: "received",
      raw_id: rawEntry.id,
    });
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`Erro ao receber webhook: ${errorMsg}`);
    return res.status(500).json({
      status: "error",
      message: errorMsg,
    });
  }
});

router.post("/webhook/zendesk/legacy", async (req: Request, res: Response) => {
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

  console.log(`Webhook (legacy) registrado - Log ID: ${logEntry.id}`);

  try {
    const adapter = getAdapter("zendesk");
    if (!adapter) {
      await storage.updateWebhookLogStatus(logEntry.id, "error", "No adapter");
      return res.status(500).json({ status: "error", message: "No adapter" });
    }

    const webhookSecret = process.env.ZENDESK_WEBHOOK_SECRET;
    const { isValid, errorMessage } = adapter.verifyAuth(rawBodyBuffer, headersDict, webhookSecret);

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

router.get("/api/conversations/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getConversationsStats();
  res.json(stats);
});

router.get("/api/conversations/grouped", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { userGroups, total } = await storage.getConversationsGroupedByUser(limit, offset);

  const enrichedGroups = await Promise.all(
    userGroups.map(async (group: any) => {
      const user = await storage.getUserBySunshineId(group.user_id);
      return {
        user_id: group.user_id,
        conversation_count: Number(group.conversation_count),
        last_activity: group.last_activity,
        first_activity: group.first_activity,
        conversations: group.conversations,
        user_info: user ? {
          id: user.id,
          external_id: user.externalId,
          authenticated: user.authenticated,
          profile: user.profile,
        } : null,
      };
    })
  );

  res.json({
    total,
    offset,
    limit,
    user_groups: enrichedGroups,
  });
});

router.get("/api/conversations/user/:userId/messages", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const result = await storage.getUserConversationsWithMessages(req.params.userId);

  if (!result) {
    return res.status(404).json({ error: "No conversations found for this user" });
  }

  res.json({
    user_id: req.params.userId,
    conversations: result.map((item) => ({
      conversation: {
        id: item.conversation.id,
        zendesk_conversation_id: item.conversation.zendeskConversationId,
        status: item.conversation.status,
        created_at: item.conversation.createdAt?.toISOString(),
        updated_at: item.conversation.updatedAt?.toISOString(),
      },
      messages: item.messages,
    })),
  });
});

router.get("/api/users/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getUsersStats();
  res.json(stats);
});

// Standard events API routes
router.get("/api/events", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const conversationId = req.query.conversation_id ? parseInt(req.query.conversation_id as string) : undefined;

  const { events, total } = await storage.getStandardEventsWithMappings(limit, offset, { source, eventType, conversationId });

  res.json({
    total,
    offset,
    limit,
    events,
  });
});

router.get("/api/events/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getStandardEventsStats();
  res.json(stats);
});

router.get("/api/webhook-raws/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getWebhookRawsStats();
  res.json(stats);
});

// Event Type Mapping API routes
router.get("/api/event-type-mappings", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const mappings = await storage.getEventTypeMappings();
  res.json({
    mappings: mappings.map((m) => ({
      id: m.id,
      source: m.source,
      event_type: m.eventType,
      display_name: m.displayName,
      description: m.description,
      show_in_list: m.showInList,
      icon: m.icon,
      created_at: m.createdAt?.toISOString(),
      updated_at: m.updatedAt?.toISOString(),
    })),
  });
});

router.post("/api/event-type-mappings", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { source, event_type, display_name, description, show_in_list, icon } = req.body;

  if (!source || !event_type || !display_name) {
    return res.status(400).json({ error: "source, event_type, and display_name are required" });
  }

  const mapping = await storage.upsertEventTypeMapping({
    source,
    eventType: event_type,
    displayName: display_name,
    description: description || null,
    showInList: show_in_list ?? true,
    icon: icon || null,
  });

  res.json({
    id: mapping.id,
    source: mapping.source,
    event_type: mapping.eventType,
    display_name: mapping.displayName,
    description: mapping.description,
    show_in_list: mapping.showInList,
    icon: mapping.icon,
  });
});

router.put("/api/event-type-mappings/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { display_name, description, show_in_list, icon } = req.body;

  const mapping = await storage.updateEventTypeMapping(id, {
    displayName: display_name,
    description,
    showInList: show_in_list,
    icon,
  });

  if (!mapping) {
    return res.status(404).json({ error: "Mapping not found" });
  }

  res.json({
    id: mapping.id,
    source: mapping.source,
    event_type: mapping.eventType,
    display_name: mapping.displayName,
    description: mapping.description,
    show_in_list: mapping.showInList,
    icon: mapping.icon,
  });
});

router.delete("/api/event-type-mappings/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await storage.deleteEventTypeMapping(id);
  res.json({ success: true });
});

// Updated events endpoint with mappings
router.get("/api/events-with-mappings", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const showInListOnly = req.query.show_in_list_only === "true";

  const { events, total } = await storage.getStandardEventsWithMappings(limit, offset, { source, eventType, showInListOnly });

  res.json({
    total,
    offset,
    limit,
    events,
  });
});

export function registerRoutes(app: Express) {
  app.use(router);
}
