import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { caseDemandStorage } from "../../ai/storage/caseDemandStorage.js";
import type { Triage } from "../../../../shared/types/index.js";

async function getProductNames(productId: number | null | undefined): Promise<{ product: string | null; subproduct: string | null }> {
  if (!productId) return { product: null, subproduct: null };
  try {
    const productInfo = await productCatalogStorage.getById(productId);
    if (productInfo) {
      return { product: productInfo.produto, subproduct: productInfo.subproduto };
    }
  } catch (error) {
    console.error(`[Conversations] Error fetching product ${productId}:`, error);
  }
  return { product: null, subproduct: null };
}

function extractTriageFromSummary(summaryJson: string | null): Triage | null {
  if (!summaryJson) return null;
  try {
    const jsonMatch = summaryJson.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.triage && typeof parsed.triage === 'object') {
      return parsed.triage as Triage;
    }
    return null;
  } catch {
    return null;
  }
}

const router = Router();

router.get("/api/conversations/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await storage.getConversationsStats();
  res.json(stats);
});

router.get("/api/conversations/filters", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const filters = await storage.getUniqueProductsAndRequestTypes();
  res.json(filters);
});

router.get("/api/conversations/grouped", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const productStandard = req.query.productStandard as string | undefined;
  const handler = req.query.handler as string | undefined;
  const emotionLevel = req.query.emotionLevel ? parseInt(req.query.emotionLevel as string) : undefined;
  const client = req.query.client as string | undefined;
  const userAuthenticated = req.query.userAuthenticated as string | undefined;
  const handledByN1ago = req.query.handledByN1ago as string | undefined;

  const { userGroups, total } = await storage.getConversationsGroupedByUser(limit, offset, productStandard, handler, emotionLevel, client, userAuthenticated, handledByN1ago);

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
        last_subproduct_standard: group.last_subproduct_standard || null,
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

router.get("/api/conversations/list", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const productStandard = req.query.productStandard as string | undefined;
  const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
  const handler = req.query.handler as string | undefined;
  const emotionLevel = req.query.emotionLevel ? parseInt(req.query.emotionLevel as string) : undefined;
  const client = req.query.client as string | undefined;
  const userAuthenticated = req.query.userAuthenticated as string | undefined;
  const handledByN1ago = req.query.handledByN1ago as string | undefined;
  const objectiveProblem = req.query.objectiveProblem as string | undefined;
  const customerRequestType = req.query.customerRequestType as string | undefined;

  const { conversations, total } = await storage.getConversationsList(limit, offset, productStandard, handler, emotionLevel, client, userAuthenticated, handledByN1ago, objectiveProblem, productId, customerRequestType);

  const enrichedConversations = conversations.map((conv: any) => ({
    id: conv.id,
    external_conversation_id: conv.external_conversation_id,
    user_id: conv.user_id,
    status: conv.status,
    created_at: conv.created_at,
    updated_at: conv.updated_at,
    closed_at: conv.closed_at,
    closed_reason: conv.closed_reason,
    current_handler: conv.current_handler,
    current_handler_name: conv.current_handler_name,
    message_count: Number(conv.message_count),
    product_standard: conv.product_standard || null,
    subproduct_standard: conv.subproduct_standard || null,
    customer_emotion_level: conv.customer_emotion_level || null,
    customer_request_type: conv.customer_request_type || null,
    objective_problems: conv.objective_problems || [],
    user_info: conv.user_db_id ? {
      id: conv.user_db_id,
      external_id: conv.user_external_id,
      authenticated: conv.user_authenticated || false,
      profile: conv.user_profile,
    } : null,
  }));

  res.json({
    total,
    offset,
    limit,
    conversations: enrichedConversations,
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
      const [summary, suggestedResponses, caseDemandData] = await Promise.all([
        storage.getConversationSummary(item.conversation.id),
        storage.getAllSuggestedResponses(item.conversation.id),
        caseDemandStorage.getFirstByConversationId(item.conversation.id),
      ]);
      const productNames = summary ? await getProductNames(summary.productId) : { product: null, subproduct: null };
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
          product_id: summary.productId,
          product: productNames.product,
          subproduct: productNames.subproduct,
          product_confidence: summary.productConfidence,
          product_confidence_reason: summary.productConfidenceReason,
          classified_at: summary.classifiedAt?.toISOString(),
          client_request: summary.clientRequest,
          client_request_versions: summary.clientRequestVersions || null,
          agent_actions: summary.agentActions,
          current_status: summary.currentStatus,
          important_info: summary.importantInfo,
          customer_emotion_level: summary.customerEmotionLevel,
          customer_request_type: summary.customerRequestType,
          customer_request_type_confidence: summary.customerRequestTypeConfidence,
          customer_request_type_reason: summary.customerRequestTypeReason,
          objective_problems: summary.objectiveProblems || null,
          articles_and_objective_problems: caseDemandData?.articlesAndObjectiveProblems || null,
          triage: extractTriageFromSummary(summary.summary),
          orchestrator_status: summary.orchestratorStatus || null,
          demand_finder_status: caseDemandData?.status || null,
        } : null,
        suggested_responses: suggestedResponses.map(sr => ({
          text: sr.suggestedResponse,
          created_at: sr.createdAt?.toISOString(),
          last_event_id: sr.lastEventId,
          status: sr.status,
          articles_used: sr.articlesUsed || null,
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

  const [summary, caseDemandData] = await Promise.all([
    storage.getConversationSummary(id),
    caseDemandStorage.getFirstByConversationId(id),
  ]);

  if (!summary) {
    return res.json({ 
      conversation_id: id,
      has_summary: false,
      summary: null,
    });
  }

  const productNames = await getProductNames(summary.productId);

  res.json({
    conversation_id: id,
    has_summary: true,
    summary: summary.summary,
    last_event_id: summary.lastEventId,
    generated_at: summary.generatedAt?.toISOString(),
    updated_at: summary.updatedAt?.toISOString(),
    product_id: summary.productId,
    product: productNames.product,
    subproduct: productNames.subproduct,
    product_confidence: summary.productConfidence,
    product_confidence_reason: summary.productConfidenceReason,
    objective_problems: summary.objectiveProblems || null,
    articles_and_objective_problems: caseDemandData?.articlesAndObjectiveProblems || null,
    customer_request_type: summary.customerRequestType,
    customer_request_type_confidence: summary.customerRequestTypeConfidence,
    customer_request_type_reason: summary.customerRequestTypeReason,
    client_request: summary.clientRequest,
    client_request_versions: summary.clientRequestVersions || null,
    agent_actions: summary.agentActions,
    current_status: summary.currentStatus,
    important_info: summary.importantInfo,
    customer_emotion_level: summary.customerEmotionLevel,
    orchestrator_status: summary.orchestratorStatus || null,
    demand_finder_status: caseDemandData?.status || null,
  });
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
