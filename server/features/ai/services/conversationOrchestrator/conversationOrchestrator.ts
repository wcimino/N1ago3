import { storage } from "../../../../storage/index.js";
import { conversationStorage } from "../../../conversations/storage/index.js";
import { SummaryAgent, ClassificationAgent, DemandFinderAgent, SolutionProviderAgent } from "./agents/index.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext, type DemandFinderAgentResult, type SummaryAgentResult } from "./types.js";
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

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.processWithStatus(context);
  }

  private static async processWithStatus(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;

    switch (currentStatus) {
      case ORCHESTRATOR_STATUS.NEW:
        await this.handleNewConversation(context);
        break;

      case ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING:
        await this.handleDemandUnderstanding(context);
        break;

      case ORCHESTRATOR_STATUS.DEMAND_RESOLVING:
        await this.handleDemandResolving(context);
        break;

      case ORCHESTRATOR_STATUS.ESCALATED:
        console.log(`[ConversationOrchestrator] Conversation ${conversationId} is escalated, skipping`);
        break;

      case ORCHESTRATOR_STATUS.CLOSED:
        console.log(`[ConversationOrchestrator] Conversation ${conversationId} is closed, skipping`);
        break;

      default:
        console.log(`[ConversationOrchestrator] Unknown status ${currentStatus} for conversation ${conversationId}`);
    }
  }

  private static async handleNewConversation(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Handling NEW conversation ${conversationId}`);

    const summaryResult = await SummaryAgent.process(context);
    if (summaryResult.success && summaryResult.summary) {
      context.summary = summaryResult.summary;
    }

    const classificationResult = await ClassificationAgent.process(context);
    if (classificationResult.success) {
      context.classification = {
        product: classificationResult.product,
        subject: classificationResult.subject,
        intent: classificationResult.intent,
      };
    }

    if (summaryResult.success && summaryResult.summary) {
      await this.persistSummary(conversationId, summaryResult, context.classification);
    }

    await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING);
    context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING;

    await this.handleDemandUnderstanding(context);
  }

  private static async handleDemandUnderstanding(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Handling DEMAND_UNDERSTANDING for conversation ${conversationId}`);

    if (!context.summary) {
      const summaryRecord = await storage.getConversationSummary(conversationId);
      if (summaryRecord) {
        context.summary = summaryRecord.summary;
        context.classification = {
          product: summaryRecord.product || undefined,
          subject: summaryRecord.subject || undefined,
          intent: summaryRecord.intent || undefined,
        };
      }
    }

    const demandResult = await DemandFinderAgent.process(context);

    if (demandResult.success && demandResult.demandIdentified) {
      context.demand = demandResult.demand;
      context.searchResults = demandResult.searchResults;

      await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_RESOLVING);
      context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_RESOLVING;

      await this.handleDemandResolving(context);
    } else if (demandResult.needsMoreInfo) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} needs more info, waiting for next message`);
    } else {
      console.log(`[ConversationOrchestrator] Demand not identified for conversation ${conversationId}, waiting`);
    }
  }

  private static async handleDemandResolving(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Handling DEMAND_RESOLVING for conversation ${conversationId}`);

    const solutionResult = await SolutionProviderAgent.process(context);

    if (solutionResult.needsEscalation) {
      await this.escalate(context, solutionResult.escalationReason || "Unable to resolve");
    } else if (solutionResult.resolved) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} resolved`);
      await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
    }
  }

  private static async escalate(context: OrchestratorContext, reason: string): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Escalating conversation ${conversationId}: ${reason}`);

    await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
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

  private static async persistSummary(
    conversationId: number, 
    summaryResult: SummaryAgentResult,
    classification?: { product?: string; subject?: string; intent?: string }
  ): Promise<void> {
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
        summary: summaryResult.summary!,
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
