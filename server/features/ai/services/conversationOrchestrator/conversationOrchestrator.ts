import { conversationStorage } from "../../../conversations/storage/index.js";
import { DemandFinderAgent } from "./agents/demandFinderAgent.js";
import { SolutionProviderAgent } from "./agents/solutionProviderAgent.js";
import { CloserAgent } from "./agents/closerAgent.js";
import { caseDemandStorage } from "../../storage/caseDemandStorage.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext, type OrchestratorAction } from "./types.js";
import { ActionExecutor } from "./actionExecutor.js";
import { isN1agoHandler } from "./helpers.js";
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

      case ORCHESTRATOR_STATUS.FINALIZING:
        await this.handleCloser(context);
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

    if (result.needsClarification) {
      console.log(`[ConversationOrchestrator] Clarification handled by DemandFinderAgent, messageSent: ${result.messageSent}`);
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
      console.log(`[ConversationOrchestrator] Solution resolved, moving to finalizing`);
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINALIZING);
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
      await this.handleCloser(context);
      return;
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

  private static async handleCloser(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;

    console.log(`[ConversationOrchestrator] Closer handling conversation ${conversationId}`);

    const result = await CloserAgent.process(context);

    if (!result.success) {
      console.log(`[ConversationOrchestrator] Closer failed: ${result.error}, closing conversation with fallback`);
      await this.closeConversation(context);
      return;
    }

    if (result.wantsMoreHelp) {
      console.log(`[ConversationOrchestrator] Customer wants more help, creating new demand`);
      
      const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
      if (activeDemand) {
        await caseDemandStorage.markAsCompleted(activeDemand.id);
        console.log(`[ConversationOrchestrator] Marked demand ${activeDemand.id} as completed`);
      }

      const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
      console.log(`[ConversationOrchestrator] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINDING_DEMAND);
      context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;

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

      await this.handleDemandFinder(context);
      return;
    }

    await this.closeConversation(context, result.suggestedResponse, result.suggestionId);
  }

  private static async closeConversation(
    context: OrchestratorContext, 
    suggestedResponse?: string, 
    suggestionId?: number
  ): Promise<void> {
    const { conversationId } = context;

    const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
    if (activeDemand) {
      await caseDemandStorage.markAsCompleted(activeDemand.id);
      console.log(`[ConversationOrchestrator] Marked demand ${activeDemand.id} as completed (closing)`);
    }

    await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
    context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;

    console.log(`[ConversationOrchestrator] Conversation ${conversationId} closed`);

    if (suggestedResponse && suggestionId) {
      const isN1ago = await isN1agoHandler(conversationId);
      if (isN1ago) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: suggestionId, responsePreview: suggestedResponse }
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
