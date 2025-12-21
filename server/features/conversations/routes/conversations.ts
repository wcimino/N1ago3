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
  const [result, user] = await Promise.all([
    storage.getUserConversationsWithMessagesOptimized(req.params.userId),
    storage.getUserBySunshineId(req.params.userId),
  ]);

  if (!result) {
    return res.status(404).json({ error: "No conversations found for this user" });
  }

  const conversationIds = result.map((row: any) => row.conv_id);
  const suggestedResponsesRaw = await storage.getSuggestedResponsesBatch(conversationIds);
  
  const suggestedResponsesByConversation = new Map<number, any[]>();
  for (const sr of suggestedResponsesRaw as any[]) {
    const convId = sr.conversation_id;
    if (!suggestedResponsesByConversation.has(convId)) {
      suggestedResponsesByConversation.set(convId, []);
    }
    suggestedResponsesByConversation.get(convId)!.push(sr);
  }

  const conversationsWithSummary = result.map((row: any) => {
    const hasSummary = row.summary_id != null;
    const suggestedResponses = suggestedResponsesByConversation.get(row.conv_id) || [];
    
    return {
      conversation: {
        id: row.conv_id,
        external_conversation_id: row.external_conversation_id,
        status: row.status,
        current_handler: row.current_handler,
        current_handler_name: row.current_handler_name,
        closed_at: row.closed_at,
        closed_reason: row.closed_reason,
        created_at: row.conv_created_at,
        updated_at: row.conv_updated_at,
        autopilot_enabled: row.autopilot_enabled,
      },
      messages: row.messages || [],
      summary: hasSummary ? {
        text: row.summary_text,
        generated_at: row.summary_generated_at,
        updated_at: row.summary_updated_at,
        product_id: row.product_id,
        product: row.product_name,
        subproduct: row.subproduct_name,
        product_confidence: row.product_confidence,
        product_confidence_reason: row.product_confidence_reason,
        classified_at: row.classified_at,
        client_request: row.client_request,
        client_request_versions: row.client_request_versions || null,
        agent_actions: row.agent_actions,
        current_status: row.current_status,
        important_info: row.important_info,
        customer_emotion_level: row.customer_emotion_level,
        customer_request_type: row.customer_request_type,
        customer_request_type_confidence: row.customer_request_type_confidence,
        customer_request_type_reason: row.customer_request_type_reason,
        objective_problems: row.objective_problems || null,
        articles_and_objective_problems: row.articles_and_objective_problems || null,
        solution_center_articles_and_problems: row.solution_center_articles_and_problems || null,
        solution_center_selected_id: row.solution_center_article_and_problems_id_selected || null,
        triage: extractTriageFromSummary(row.summary_text),
        orchestrator_status: row.orchestrator_status || null,
        demand_finder_status: row.demand_finder_status || null,
        demand_finder_interaction_count: row.demand_finder_interaction_count || 0,
        conversation_orchestrator_log: row.conversation_orchestrator_log || null,
      } : null,
      suggested_responses: suggestedResponses.map((sr: any) => ({
        text: sr.suggested_response,
        created_at: sr.created_at,
        last_event_id: sr.last_event_id,
        status: sr.status,
        articles_used: sr.articles_used || null,
      })),
    };
  });

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
    solution_center_articles_and_problems: caseDemandData?.solutionCenterArticlesAndProblems || null,
    solution_center_selected_id: caseDemandData?.solutionCenterArticleAndProblemsIdSelected || null,
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
    demand_finder_interaction_count: caseDemandData?.interactionCount || 0,
    conversation_orchestrator_log: summary.conversationOrchestratorLog || null,
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
