import { storage } from "../../../../storage/index.js";
import { conversationStorage } from "../../../conversations/storage/index.js";
import { SummaryAgent, ClassificationAgent, DemandFinderAgent, SolutionProviderAgent } from "./agents/index.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext, type SummaryAgentResult } from "./types.js";
import type { EventStandard } from "../../../../../shared/schema.js";

export class ConversationOrchestrator {
  static async processMessageEvent(event: EventStandard): Promise<void> {
    if (!event.conversationId) {
      console.log("[ConversationOrchestrator] No conversationId, skipping");
      return;
    }

    if (event.authorType !== "customer" && event.authorType !== "end_user") {
      console.log(`[ConversationOrchestrator] Skipping non-customer message (author: ${event.authorType})`);
      return;
    }

    const conversationId = event.conversationId;
    const currentStatus = await this.getConversationStatus(conversationId);

    console.log(`[ConversationOrchestrator] Processing event ${event.id} for conversation ${conversationId}, status: ${currentStatus}`);

    if (currentStatus === ORCHESTRATOR_STATUS.ESCALATED) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} is escalated, skipping`);
      return;
    }

    if (currentStatus === ORCHESTRATOR_STATUS.CLOSED) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} is closed, skipping`);
      return;
    }

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.processSyncPipeline(context);
  }

  private static async processSyncPipeline(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;

    console.log(`[ConversationOrchestrator] Starting sync pipeline for conversation ${conversationId}`);

    const summaryResult = await this.step1_GenerateSummary(context);

    await this.step2_Classify(context);

    await this.persistSummaryWithClassification(conversationId, summaryResult, context.classification);

    await this.step3_DecideStatus(context);

    const agentResponse = await this.step4_RouteToAgent(context);

    if (agentResponse) {
      await this.step5_SendResponse(context, agentResponse);
    }

    console.log(`[ConversationOrchestrator] Pipeline completed for conversation ${conversationId}, final status: ${context.currentStatus}`);
  }

  private static async step1_GenerateSummary(context: OrchestratorContext): Promise<SummaryAgentResult> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 1: Generating summary for conversation ${conversationId}`);

    const existingSummary = await storage.getConversationSummary(conversationId);
    
    if (existingSummary) {
      context.summary = existingSummary.summary;
      context.classification = {
        product: existingSummary.product || undefined,
        subject: existingSummary.subject || undefined,
        intent: existingSummary.intent || undefined,
      };
    }

    const summaryResult = await SummaryAgent.process(context);
    
    if (summaryResult.success && summaryResult.summary) {
      context.summary = summaryResult.summary;
      console.log(`[ConversationOrchestrator] Step 1: Summary generated successfully`);
    } else {
      console.log(`[ConversationOrchestrator] Step 1: Using existing summary`);
    }

    return summaryResult;
  }

  private static async step2_Classify(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 2: Classifying conversation ${conversationId}`);

    const classificationResult = await ClassificationAgent.process(context);
    
    if (classificationResult.success) {
      context.classification = {
        product: classificationResult.product || context.classification?.product,
        subject: classificationResult.subject || context.classification?.subject,
        intent: classificationResult.intent || context.classification?.intent,
      };
      console.log(`[ConversationOrchestrator] Step 2: Classification successful - ${context.classification.product}/${context.classification.subject}/${context.classification.intent}`);
    } else {
      console.log(`[ConversationOrchestrator] Step 2: Classification failed or skipped, keeping existing`);
    }
  }

  private static async step3_DecideStatus(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;
    console.log(`[ConversationOrchestrator] Step 3: Deciding status for conversation ${conversationId}, current: ${currentStatus}`);

    if (currentStatus === ORCHESTRATOR_STATUS.NEW) {
      await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING);
      context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING;
      console.log(`[ConversationOrchestrator] Step 3: Status updated to DEMAND_UNDERSTANDING`);
    } else {
      console.log(`[ConversationOrchestrator] Step 3: Status remains ${currentStatus}`);
    }
  }

  private static async step4_RouteToAgent(context: OrchestratorContext): Promise<string | null> {
    const { conversationId, currentStatus } = context;
    console.log(`[ConversationOrchestrator] Step 4: Routing to agent based on status ${currentStatus}`);

    let response: string | null = null;

    const demandResult = await DemandFinderAgent.process(context);

    if (demandResult.success && demandResult.demandIdentified) {
      context.demand = demandResult.demand;
      context.searchResults = demandResult.searchResults;

      if (currentStatus !== ORCHESTRATOR_STATUS.DEMAND_RESOLVING) {
        await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_RESOLVING);
        context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_RESOLVING;
      }

      console.log(`[ConversationOrchestrator] Step 4: Demand confirmed, running SolutionProvider`);
      
      const solutionResult = await SolutionProviderAgent.process(context);

      if (solutionResult.needsEscalation) {
        await this.escalate(context, solutionResult.escalationReason || "Unable to resolve");
      } else if (solutionResult.resolved) {
        await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
        console.log(`[ConversationOrchestrator] Step 4: Resolved`);
      }

      response = solutionResult.suggestedResponse || null;

    } else if (demandResult.needsMoreInfo) {
      if (currentStatus === ORCHESTRATOR_STATUS.DEMAND_RESOLVING) {
        await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING);
        context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING;
        console.log(`[ConversationOrchestrator] Step 4: Downgraded to DEMAND_UNDERSTANDING - need more info`);
      }

      if (demandResult.followUpQuestion) {
        console.log(`[ConversationOrchestrator] Step 4: Need more info, returning follow-up question`);
        response = demandResult.followUpQuestion;
      }
    } else {
      console.log(`[ConversationOrchestrator] Step 4: Demand not identified, waiting for more context`);
    }

    return response;
  }

  private static async step5_SendResponse(context: OrchestratorContext, response: string): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 5: Sending response for conversation ${conversationId}`);
    console.log(`[ConversationOrchestrator] Step 5: Response: "${response.substring(0, 100)}..."`);
    
    console.log(`[ConversationOrchestrator] Step 5: Response sending not implemented yet`);
  }

  private static async escalate(context: OrchestratorContext, reason: string): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Escalating conversation ${conversationId}: ${reason}`);

    await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
  }

  static async getConversationStatus(conversationId: number): Promise<OrchestratorStatus> {
    try {
      const conversation = await conversationStorage.getById(conversationId);
      if (conversation && conversation.orchestratorStatus) {
        return conversation.orchestratorStatus as OrchestratorStatus;
      }
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error getting status for ${conversationId}:`, error);
    }
    return ORCHESTRATOR_STATUS.NEW;
  }

  static async updateStatus(conversationId: number, status: OrchestratorStatus): Promise<void> {
    try {
      await conversationStorage.updateOrchestratorStatus(conversationId, status);
      console.log(`[ConversationOrchestrator] Updated conversation ${conversationId} status to: ${status}`);
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error updating status for ${conversationId}:`, error);
    }
  }

  private static async persistSummaryWithClassification(
    conversationId: number, 
    summaryResult: SummaryAgentResult,
    classification?: { product?: string; subject?: string; intent?: string }
  ): Promise<void> {
    if (!summaryResult.success || !summaryResult.summary) {
      console.log(`[ConversationOrchestrator] No new summary to persist`);
      return;
    }

    try {
      const existingSummary = await storage.getConversationSummary(conversationId);
      
      if (existingSummary && existingSummary.lastEventId === summaryResult.lastEventId) {
        console.log(`[ConversationOrchestrator] Summary for event ${summaryResult.lastEventId} already persisted, skipping`);
        return;
      }

      const finalProduct = classification?.product ?? existingSummary?.product ?? undefined;
      const finalSubject = classification?.subject ?? existingSummary?.subject ?? undefined;
      const finalIntent = classification?.intent ?? existingSummary?.intent ?? undefined;

      await storage.upsertConversationSummary({
        conversationId,
        externalConversationId: summaryResult.externalConversationId || undefined,
        summary: summaryResult.summary,
        clientRequest: summaryResult.structured?.clientRequest,
        agentActions: summaryResult.structured?.agentActions,
        currentStatus: summaryResult.structured?.currentStatus,
        importantInfo: summaryResult.structured?.importantInfo,
        customerEmotionLevel: summaryResult.structured?.customerEmotionLevel,
        customerRequestType: summaryResult.structured?.customerRequestType,
        objectiveProblems: summaryResult.structured?.objectiveProblems,
        articlesAndObjectiveProblems: summaryResult.structured?.articlesAndObjectiveProblems,
        lastEventId: summaryResult.lastEventId!,
        product: finalProduct,
        subject: finalSubject,
        intent: finalIntent,
      });

      console.log(`[ConversationOrchestrator] Summary persisted for conversation ${conversationId}`);
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error persisting summary for ${conversationId}:`, error);
    }
  }
}

export async function processConversationEvent(event: EventStandard): Promise<void> {
  await ConversationOrchestrator.processMessageEvent(event);
}
