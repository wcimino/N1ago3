import { conversationStorage } from "../../../conversations/storage/index.js";
import { DemandFinderAgent } from "./agents/demandFinderAgent.js";
import { CloserAgent } from "./agents/closerAgent.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorStatus, type ConversationOwner, type OrchestratorContext, type DispatchResult } from "./types.js";
import type { EventStandard } from "../../../../../shared/schema.js";

const MAX_DISPATCHES_PER_EVENT = 3;

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

    console.log(`[ConversationOrchestrator] State: status=${currentStatus}, owner=${owner}, waitingForCustomer=${state.waitingForCustomer}, lastProcessedEventId=${state.lastProcessedEventId}`);

    if (this.isTerminalStatus(currentStatus)) {
      console.log(`[ConversationOrchestrator] Conversation in terminal status ${currentStatus}, skipping`);
      return;
    }

    if (state.lastProcessedEventId === event.id) {
      console.log(`[ConversationOrchestrator] Event ${event.id} already processed, skipping`);
      return;
    }

    const claimed = await conversationStorage.tryClaimEventForProcessing(
      conversationId,
      event.id,
      state.lastProcessedEventId
    );

    if (!claimed) {
      console.log(`[ConversationOrchestrator] Failed to claim event ${event.id} (concurrent processing), skipping`);
      return;
    }

    console.log(`[ConversationOrchestrator] Claimed event ${event.id} for processing`);

    if (!owner) {
      owner = CONVERSATION_OWNER.DEMAND_FINDER;
      console.log(`[ConversationOrchestrator] No owner set, defaulting to ${owner}`);
    }

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.runDispatchLoop(context, owner);
    console.log(`[ConversationOrchestrator] Completed processing for conversation ${conversationId}`);
  }

  private static async runDispatchLoop(context: OrchestratorContext, initialOwner: ConversationOwner): Promise<void> {
    const { conversationId } = context;
    let currentOwner: ConversationOwner | null = initialOwner;
    let dispatchCount = 0;

    while (currentOwner && dispatchCount < MAX_DISPATCHES_PER_EVENT) {
      dispatchCount++;
      console.log(`[ConversationOrchestrator] Dispatch ${dispatchCount}/${MAX_DISPATCHES_PER_EVENT} to ${currentOwner} for conversation ${conversationId}`);

      const stateBeforeDispatch = await conversationStorage.getOrchestratorState(conversationId);
      context.lastDispatchLog = undefined;

      const result = await this.dispatchToOwner(context, currentOwner);

      await this.saveDispatchLog(conversationId, dispatchCount, currentOwner, stateBeforeDispatch, context, result);

      if (!result.success) {
        console.error(`[ConversationOrchestrator] Dispatch to ${currentOwner} failed: ${result.error}`);
        break;
      }

      if (!result.shouldContinue) {
        console.log(`[ConversationOrchestrator] Agent ${currentOwner} finished turn, waiting for next event`);
        break;
      }

      if (result.newOwner && result.newOwner !== currentOwner) {
        console.log(`[ConversationOrchestrator] Owner changed from ${currentOwner} to ${result.newOwner}, continuing dispatch chain`);
        
        const refreshedState = await conversationStorage.getOrchestratorState(conversationId);
        context.currentStatus = (refreshedState.orchestratorStatus || ORCHESTRATOR_STATUS.NEW) as OrchestratorStatus;
        
        currentOwner = result.newOwner;
      } else {
        break;
      }
    }

    if (dispatchCount >= MAX_DISPATCHES_PER_EVENT) {
      console.warn(`[ConversationOrchestrator] Max dispatches (${MAX_DISPATCHES_PER_EVENT}) reached for conversation ${conversationId}, stopping to prevent infinite loop`);
    }
  }

  private static async saveDispatchLog(
    conversationId: number,
    turn: number,
    agent: ConversationOwner,
    stateBeforeDispatch: { orchestratorStatus: string | null; conversationOwner: string | null; waitingForCustomer: boolean },
    context: OrchestratorContext,
    result: DispatchResult
  ): Promise<void> {
    try {
      const logData = context.lastDispatchLog;
      
      await conversationStorage.appendOrchestratorLog(conversationId, {
        turn,
        agent,
        state: {
          status: stateBeforeDispatch.orchestratorStatus || "new",
          owner: stateBeforeDispatch.conversationOwner,
          waitingForCustomer: stateBeforeDispatch.waitingForCustomer,
        },
        solutionCenterResults: logData?.solutionCenterResults ?? 0,
        aiDecision: logData?.aiDecision ?? null,
        aiReason: logData?.aiReason ?? null,
        action: logData?.action ?? (result.success ? "completed" : "failed"),
        details: {
          ...logData?.details,
          newOwner: result.newOwner,
          shouldContinue: result.shouldContinue,
          error: result.error,
        },
      });
    } catch (error) {
      console.error(`[ConversationOrchestrator] Failed to save dispatch log:`, error);
    }
  }

  private static isTerminalStatus(status: OrchestratorStatus): boolean {
    return status === ORCHESTRATOR_STATUS.ESCALATED || 
           status === ORCHESTRATOR_STATUS.CLOSED;
  }

  private static async dispatchToOwner(context: OrchestratorContext, owner: ConversationOwner): Promise<DispatchResult> {
    const { conversationId } = context;

    try {
      const previousOwner = owner;
      
      switch (owner) {
        case CONVERSATION_OWNER.DEMAND_FINDER:
          await DemandFinderAgent.process(context);
          break;

        case CONVERSATION_OWNER.CLOSER:
          await CloserAgent.process(context);
          break;

        default:
          console.log(`[ConversationOrchestrator] Unknown owner ${owner}, defaulting to DemandFinder`);
          await DemandFinderAgent.process(context);
      }

      const newState = await conversationStorage.getOrchestratorState(conversationId);
      const newOwner = newState.conversationOwner as ConversationOwner | null;
      const newStatus = newState.orchestratorStatus as OrchestratorStatus;

      if (this.isTerminalStatus(newStatus)) {
        return { success: true, newOwner: null, shouldContinue: false };
      }

      const ownerChanged = newOwner !== null && newOwner !== previousOwner;
      const shouldContinue = ownerChanged && !newState.waitingForCustomer;

      return { 
        success: true, 
        newOwner, 
        shouldContinue,
      };
    } catch (error: any) {
      console.error(`[ConversationOrchestrator] Error dispatching to ${owner}:`, error);
      return { 
        success: false, 
        newOwner: null, 
        shouldContinue: false, 
        error: error.message || "Unknown error" 
      };
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
