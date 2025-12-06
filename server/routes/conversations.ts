import { Router, type Request, type Response } from "express";
import { storage } from "../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../middleware/auth.js";

const router = Router();

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

  const conversationsWithSummary = await Promise.all(
    result.map(async (item) => {
      const [summary, suggestedResponse] = await Promise.all([
        storage.getConversationSummary(item.conversation.id),
        storage.getSuggestedResponse(item.conversation.id),
      ]);
      return {
        conversation: {
          id: item.conversation.id,
          zendesk_conversation_id: item.conversation.zendeskConversationId,
          status: item.conversation.status,
          created_at: item.conversation.createdAt?.toISOString(),
          updated_at: item.conversation.updatedAt?.toISOString(),
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
        } : null,
        suggested_response: suggestedResponse ? {
          text: suggestedResponse.suggestedResponse,
          created_at: suggestedResponse.createdAt?.toISOString(),
          last_event_id: suggestedResponse.lastEventId,
        } : null,
      };
    })
  );

  res.json({
    user_id: req.params.userId,
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
  });
});

router.get("/api/users/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getUsersStats();
  res.json(stats);
});

export default router;
