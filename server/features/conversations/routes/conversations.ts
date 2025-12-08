import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/api/conversations/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getConversationsStats();
  res.json(stats);
});

router.get("/api/conversations/filters", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const filters = await storage.getUniqueProductsAndIntents();
  res.json(filters);
});

router.get("/api/conversations/grouped", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const productStandard = req.query.productStandard as string | undefined;
  const intent = req.query.intent as string | undefined;
  const handler = req.query.handler as string | undefined;
  const emotionLevel = req.query.emotionLevel ? parseInt(req.query.emotionLevel as string) : undefined;

  const { userGroups, total } = await storage.getConversationsGroupedByUser(limit, offset, productStandard, intent, handler, emotionLevel);

  const enrichedGroups = await Promise.all(
    userGroups.map(async (group: any) => {
      const user = await storage.getUserBySunshineId(group.user_id);
      return {
        user_id: group.user_id,
        conversation_count: Number(group.conversation_count),
        last_activity: group.last_activity,
        first_activity: group.first_activity,
        conversations: group.conversations,
        last_product_standard: group.last_product_standard || null,
        last_intent: group.last_intent || null,
        last_customer_emotion_level: group.last_customer_emotion_level || null,
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

  const user = await storage.getUserBySunshineId(req.params.userId);

  const conversationsWithSummary = await Promise.all(
    result.map(async (item) => {
      const [summary, suggestedResponses] = await Promise.all([
        storage.getConversationSummary(item.conversation.id),
        storage.getAllSuggestedResponses(item.conversation.id),
      ]);
      return {
        conversation: {
          id: item.conversation.id,
          external_conversation_id: item.conversation.externalConversationId,
          status: item.conversation.status,
          current_handler: item.conversation.currentHandler,
          current_handler_name: item.conversation.currentHandlerName,
          closed_at: item.conversation.closedAt,
          closed_reason: item.conversation.closedReason,
          created_at: item.conversation.createdAt,
          updated_at: item.conversation.updatedAt,
          autopilot_enabled: item.conversation.autopilotEnabled,
        },
        messages: item.messages,
        summary: summary ? {
          text: summary.summary,
          generated_at: summary.generatedAt?.toISOString(),
          updated_at: summary.updatedAt?.toISOString(),
          product: summary.product,
          intent: summary.intent,
          confidence: summary.confidence,
          classified_at: summary.classifiedAt?.toISOString(),
          client_request: summary.clientRequest,
          agent_actions: summary.agentActions,
          current_status: summary.currentStatus,
          important_info: summary.importantInfo,
          customer_emotion_level: summary.customerEmotionLevel,
        } : null,
        suggested_responses: suggestedResponses.map(sr => ({
          text: sr.suggestedResponse,
          created_at: sr.createdAt?.toISOString(),
          last_event_id: sr.lastEventId,
        })),
      };
    })
  );

  res.json({
    user_id: req.params.userId,
    user_profile: user?.profile || null,
    conversations: conversationsWithSummary,
  });
});

router.get("/api/conversations/:id/summary", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const summary = await storage.getConversationSummary(id);

  if (!summary) {
    return res.json({ 
      conversation_id: id,
      has_summary: false,
      summary: null,
    });
  }

  res.json({
    conversation_id: id,
    has_summary: true,
    summary: summary.summary,
    last_event_id: summary.lastEventId,
    generated_at: summary.generatedAt?.toISOString(),
    updated_at: summary.updatedAt?.toISOString(),
    product: summary.product,
    intent: summary.intent,
    confidence: summary.confidence,
    client_request: summary.clientRequest,
    agent_actions: summary.agentActions,
    current_status: summary.currentStatus,
    important_info: summary.importantInfo,
    customer_emotion_level: summary.customerEmotionLevel,
  });
});

router.get("/api/users/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getUsersStats();
  res.json(stats);
});

router.patch("/api/conversations/:id/autopilot", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const { enabled } = req.body;
  
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }

  const result = await storage.updateConversationAutopilot(id, enabled);
  
  if (!result) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json({ 
    conversation_id: id, 
    autopilot_enabled: enabled,
    message: enabled ? "AutoPilot ativado" : "AutoPilot pausado"
  });
});

export default router;
