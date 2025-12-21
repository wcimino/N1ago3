import { conversationStorage } from "../../../conversations/storage/index.js";
import { DemandFinderAgent } from "./agents/demandFinderAgent.js";
import { SolutionProviderAgent } from "./agents/solutionProviderAgent.js";
import { CloserAgent } from "./agents/closerAgent.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorStatus, type ConversationOwner, type OrchestratorContext } from "./types.js";
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
    console.log(`[ConversationOrchestrator] Processing message for conversation ${conversationId}`);

    const state = await conversationStorage.getOrchestratorState(conversationId);
    const currentStatus = (state.orchestratorStatus || ORCHESTRATOR_STATUS.NEW) as OrchestratorStatus;
    let owner = state.conversationOwner as ConversationOwner | null;

    console.log(`[ConversationOrchestrator] State: status=${currentStatus}, owner=${owner}, waitingForCustomer=${state.waitingForCustomer}`);

    if (this.isTerminalStatus(currentStatus)) {
      console.log(`[ConversationOrchestrator] Conversation in terminal status ${currentStatus}, skipping`);
      return;
    }

    if (state.waitingForCustomer) {
      console.log(`[ConversationOrchestrator] Customer replied, resetting waitingForCustomer`);
      await conversationStorage.updateOrchestratorState(conversationId, {
        waitingForCustomer: false,
      });
    }

    if (!owner) {
      owner = CONVERSATION_OWNER.DEMAND_FINDER;
      console.log(`[ConversationOrchestrator] No owner set, defaulting to ${owner}`);
    }

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.dispatchToOwner(context, owner);

    await conversationStorage.updateOrchestratorState(conversationId, {
      lastProcessedEventId: event.id,
    });

    console.log(`[ConversationOrchestrator] Completed processing for conversation ${conversationId}`);
  }

  private static isTerminalStatus(status: OrchestratorStatus): boolean {
    return status === ORCHESTRATOR_STATUS.ESCALATED || 
           status === ORCHESTRATOR_STATUS.CLOSED;
  }

  private static async dispatchToOwner(context: OrchestratorContext, owner: ConversationOwner): Promise<void> {
    const { conversationId } = context;

    console.log(`[ConversationOrchestrator] Dispatching to ${owner} for conversation ${conversationId}`);

    switch (owner) {
      case CONVERSATION_OWNER.DEMAND_FINDER:
        await DemandFinderAgent.process(context);
        break;

      case CONVERSATION_OWNER.SOLUTION_PROVIDER:
        await SolutionProviderAgent.process(context);
        break;

      case CONVERSATION_OWNER.CLOSER:
        await CloserAgent.process(context);
        break;

      default:
        console.log(`[ConversationOrchestrator] Unknown owner ${owner}, defaulting to DemandFinder`);
        await DemandFinderAgent.process(context);
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
}

export async function processConversationEvent(event: EventStandard): Promise<void> {
  await ConversationOrchestrator.processMessageEvent(event);
}
