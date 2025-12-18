import { conversationStorage } from "../../../conversations/storage/index.js";
import { DemandFinderAgent } from "./agents/demandFinderAgent.js";
import { SolutionProviderAgent } from "./agents/solutionProviderAgent.js";
import { CloserAgent } from "./agents/closerAgent.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext } from "./types.js";
import type { EventStandard } from "../../../../../shared/schema.js";

const MAX_DISPATCH_ITERATIONS = 5;

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
    let iterations = 0;

    console.log(`[ConversationOrchestrator] Starting dispatch loop for conversation ${conversationId}`);

    while (iterations < MAX_DISPATCH_ITERATIONS) {
      const currentStatus = await this.getConversationStatus(conversationId);

      console.log(`[ConversationOrchestrator] Iteration ${iterations + 1}: status = ${currentStatus}`);

      if (this.isTerminalStatus(currentStatus)) {
        console.log(`[ConversationOrchestrator] Reached terminal status ${currentStatus}, stopping`);
        break;
      }

      const context: OrchestratorContext = {
        event,
        conversationId,
        currentStatus,
      };

      const previousStatus = currentStatus;
      await this.dispatchToAgent(context);

      const newStatus = await this.getConversationStatus(conversationId);

      if (newStatus === previousStatus) {
        console.log(`[ConversationOrchestrator] Status unchanged (${newStatus}), stopping loop`);
        break;
      }

      console.log(`[ConversationOrchestrator] Status changed: ${previousStatus} -> ${newStatus}`);
      iterations++;
    }

    if (iterations >= MAX_DISPATCH_ITERATIONS) {
      console.warn(`[ConversationOrchestrator] Max iterations (${MAX_DISPATCH_ITERATIONS}) reached for conversation ${conversationId}`);
    }

    console.log(`[ConversationOrchestrator] Dispatch loop completed for conversation ${conversationId}`);
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
        await DemandFinderAgent.process(context);
        break;

      case ORCHESTRATOR_STATUS.DEMAND_CONFIRMED:
      case ORCHESTRATOR_STATUS.PROVIDING_SOLUTION:
      case ORCHESTRATOR_STATUS.AWAITING_SOLUTION_INPUTS:
        await SolutionProviderAgent.process(context);
        break;

      case ORCHESTRATOR_STATUS.FINALIZING:
        await CloserAgent.process(context);
        break;

      default:
        console.log(`[ConversationOrchestrator] Unknown status ${currentStatus}, defaulting to DemandFinder`);
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
