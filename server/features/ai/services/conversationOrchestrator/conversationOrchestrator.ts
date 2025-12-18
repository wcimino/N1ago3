import { conversationStorage } from "../../../conversations/storage/index.js";
import { DemandFinderAgent } from "./agents/demandFinderAgent.js";
import { SolutionProviderAgent } from "./agents/solutionProviderAgent.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext, type OrchestratorAction } from "./types.js";
import { ActionExecutor } from "./actionExecutor.js";
import { ZendeskApiService } from "../../../external-sources/zendesk/services/zendeskApiService.js";
import type { EventStandard } from "../../../../../shared/schema.js";

async function isN1agoHandler(conversationId: number): Promise<boolean> {
  const conversation = await conversationStorage.getById(conversationId);
  if (!conversation) {
    return false;
  }
  
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  return conversation.currentHandler === n1agoIntegrationId || 
    conversation.currentHandlerName?.startsWith("n1ago") || false;
}

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

    if (this.isTerminalStatus(currentStatus)) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} is in terminal status ${currentStatus}, skipping`);
      return;
    }

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.dispatchToAgent(context);
  }

  private static isTerminalStatus(status: OrchestratorStatus): boolean {
    return status === ORCHESTRATOR_STATUS.COMPLETED || 
           status === ORCHESTRATOR_STATUS.ESCALATED || 
           status === ORCHESTRATOR_STATUS.CLOSED;
  }

  private static async dispatchToAgent(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;

    console.log(`[ConversationOrchestrator] Dispatching conversation ${conversationId} with status: ${currentStatus}`);

    switch (currentStatus) {
      case ORCHESTRATOR_STATUS.NEW:
      case ORCHESTRATOR_STATUS.FINDING_DEMAND:
      case ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY:
        await this.handleDemandFinder(context);
        break;

      case ORCHESTRATOR_STATUS.DEMAND_CONFIRMED:
      case ORCHESTRATOR_STATUS.PROVIDING_SOLUTION:
        await this.handleSolutionProvider(context);
        break;

      default:
        console.log(`[ConversationOrchestrator] Unknown status ${currentStatus}, defaulting to DemandFinder`);
        await this.handleDemandFinder(context);
    }

    console.log(`[ConversationOrchestrator] Dispatch completed for conversation ${conversationId}`);
  }

  private static async handleDemandFinder(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;

    console.log(`[ConversationOrchestrator] DemandFinder handling conversation ${conversationId}`);

    if (currentStatus === ORCHESTRATOR_STATUS.NEW || currentStatus === ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY) {
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINDING_DEMAND);
      context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
    }

    const result = await DemandFinderAgent.process(context);

    if (!result.success) {
      console.log(`[ConversationOrchestrator] DemandFinder failed: ${result.error}`);
      return;
    }

    if (result.demandConfirmed) {
      console.log(`[ConversationOrchestrator] Demand confirmed, proceeding to SolutionProvider`);
      context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_CONFIRMED;
      await this.handleSolutionProvider(context);
      return;
    }

    if (result.maxInteractionsReached) {
      console.log(`[ConversationOrchestrator] Max interactions reached, escalating`);
      
      const isN1ago = await isN1agoHandler(conversationId);
      if (isN1ago && result.suggestedResponse) {
        const action: OrchestratorAction = {
          type: "TRANSFER_TO_HUMAN",
          payload: { reason: "max_interactions_reached", message: result.suggestedResponse }
        };
        await ActionExecutor.execute(context, [action]);
      }
      return;
    }

    if (result.needsClarification && result.suggestedResponse && result.suggestionId) {
      console.log(`[ConversationOrchestrator] Sending clarification question`);
      
      const isN1ago = await isN1agoHandler(conversationId);
      if (isN1ago) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: result.suggestionId, responsePreview: result.suggestedResponse }
        };
        await ActionExecutor.execute(context, [action]);
      }
    }
  }

  private static async handleSolutionProvider(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;

    console.log(`[ConversationOrchestrator] SolutionProvider handling conversation ${conversationId}`);

    if (currentStatus === ORCHESTRATOR_STATUS.DEMAND_CONFIRMED) {
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.PROVIDING_SOLUTION);
      context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;
    }

    context.demandFound = true;

    const result = await SolutionProviderAgent.process(context);

    if (!result.success) {
      console.log(`[ConversationOrchestrator] SolutionProvider failed: ${result.error}`);
      return;
    }

    if (result.needsEscalation) {
      console.log(`[ConversationOrchestrator] SolutionProvider needs escalation: ${result.escalationReason}`);
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
      return;
    }

    if (result.resolved) {
      console.log(`[ConversationOrchestrator] Solution resolved, marking as completed`);
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.COMPLETED);
    }

    if (result.suggestedResponse && result.suggestionId) {
      const isN1ago = await isN1agoHandler(conversationId);
      if (isN1ago) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: result.suggestionId, responsePreview: result.suggestedResponse }
        };
        await ActionExecutor.execute(context, [action]);
      }
    }
  }

  static async getConversationStatus(conversationId: number): Promise<OrchestratorStatus> {
    try {
      const status = await conversationStorage.getOrchestratorStatus(conversationId);
      if (status) {
        return status as OrchestratorStatus;
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
}

export async function processConversationEvent(event: EventStandard): Promise<void> {
  await ConversationOrchestrator.processMessageEvent(event);
}
