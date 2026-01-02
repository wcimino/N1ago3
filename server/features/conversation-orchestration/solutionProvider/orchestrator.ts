import { caseSolutionStorage } from "../../ai/storage/caseSolutionStorage.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import { 
  ORCHESTRATOR_STATUS, 
  CONVERSATION_OWNER, 
  type OrchestratorContext,
  createAgentLogger,
  escalateConversation,
} from "../shared/index.js";
import {
  selectNextAction,
  allActionsCompleted,
  decideActionExecution,
  type CaseAction,
  type ActionDecision,
} from "./stateMachine.js";
import {
  executeTransferToHuman,
  executeAutomaticAction,
  executeSendMessageAction,
  executeInternalAction,
  executeSkipUnknown,
  type ActionExecutionResult,
} from "./actionExecutors.js";

const MAX_INTERACTIONS = 5;
const log = createAgentLogger("SolutionProviderOrchestrator");

export interface SolutionProviderOrchestratorResult {
  success: boolean;
  solutionFound: boolean;
  caseSolutionId?: number;
  actionExecuted?: string;
  escalated: boolean;
  waitingForCustomer?: boolean;
  messageSent?: boolean;
  error?: string;
}

export class SolutionProviderOrchestrator {
  static async process(
    context: OrchestratorContext,
    caseSolutionId: number,
    actions: CaseAction[]
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId } = context;
    const MAX_ACTIONS_PER_TURN = 10;
    let actionsProcessed = 0;

    try {
      log.action(conversationId, `Processing caseSolution ${caseSolutionId}`, `${actions.length} actions`);

      while (actionsProcessed < MAX_ACTIONS_PER_TURN) {
        actionsProcessed++;
        
        const currentActions = await caseSolutionStorage.getActions(caseSolutionId);

        if (allActionsCompleted(currentActions)) {
          log.action(conversationId, "All actions completed, transitioning to Closer");
          return await this.transitionToCloser(context, caseSolutionId);
        }

        const nextAction = selectNextAction(currentActions);
        if (!nextAction) {
          log.warn(conversationId, "No pending action found, escalating");
          return await this.escalate(context, caseSolutionId, "No pending action found");
        }

        log.info(conversationId, `Iteration ${actionsProcessed}: action ${nextAction.id} (sequence: ${nextAction.actionSequence})`);

        const decision = decideActionExecution(nextAction);
        log.decision(conversationId, decision.decision, `requiresAI: ${decision.requiresAI}`);

        if (decision.requiresAI) {
          const currentInteractionCount = await caseSolutionStorage.getInteractionCount(caseSolutionId);
          log.info(conversationId, `Interaction count: ${currentInteractionCount}/${MAX_INTERACTIONS}`);

          if (currentInteractionCount >= MAX_INTERACTIONS) {
            log.warn(conversationId, "Max interactions reached, escalating");
            return await this.escalate(context, caseSolutionId, "Max interactions reached");
          }

          await caseSolutionStorage.incrementInteractionCount(caseSolutionId);
          log.info(conversationId, "Incremented interaction count");
        }

        const result = await this.executeDecision(context, caseSolutionId, decision);

        if (result.escalated || result.waitingForCustomer) {
          log.info(conversationId, `Stopping loop: escalated=${result.escalated}, waitingForCustomer=${result.waitingForCustomer}`);
          return result;
        }

        log.info(conversationId, "Action completed, continuing to next action");
      }

      log.warn(conversationId, `Max actions per turn (${MAX_ACTIONS_PER_TURN}) reached, escalating`);
      return await this.escalate(context, caseSolutionId, "Solution too complex - max actions per turn exceeded");

    } catch (error: any) {
      log.error(conversationId, "Error", error);
      return await this.escalate(context, caseSolutionId, error.message || "Orchestrator error");
    }
  }

  private static async executeDecision(
    context: OrchestratorContext,
    caseSolutionId: number,
    decision: ActionDecision
  ): Promise<SolutionProviderOrchestratorResult> {
    const action = decision.action;

    await caseSolutionStorage.updateActionStatus(action.id, "in_progress");

    switch (decision.decision) {
      case "transfer_to_human":
        return await executeTransferToHuman(context, caseSolutionId, action);

      case "execute_automatic":
        return await executeAutomaticAction(context, caseSolutionId, action);

      case "send_message_to_customer":
        return await executeSendMessageAction(context, caseSolutionId, action, false, this.escalate.bind(this));

      case "ask_customer_for_input":
        return await executeSendMessageAction(context, caseSolutionId, action, true, this.escalate.bind(this));

      case "execute_internal":
        return await executeInternalAction(context, caseSolutionId, action);

      case "skip_unknown":
        return await executeSkipUnknown(caseSolutionId, action);

      default:
        return await this.escalate(context, caseSolutionId, `Unknown decision: ${decision.decision}`);
    }
  }

  private static async transitionToCloser(
    context: OrchestratorContext,
    caseSolutionId: number
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId } = context;

    await caseSolutionStorage.updateStatus(caseSolutionId, "resolved");
    
    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
      conversationOwner: CONVERSATION_OWNER.CLOSER,
      waitingForCustomer: false,
    });

    context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

    context.lastDispatchLog = {
      solutionCenterResults: 1,
      aiDecision: "solution_completed",
      aiReason: "All actions completed",
      action: "transition_to_closer",
      details: { caseSolutionId },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "solution_completed",
      escalated: false,
    };
  }

  private static async escalate(
    context: OrchestratorContext,
    caseSolutionId: number,
    reason: string
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId } = context;

    console.log(`[SolutionProviderOrchestrator] Escalating: ${reason}`);

    await escalateConversation(conversationId, context, reason, {
      sendApologyMessage: true,
      apologyMessage: "Desculpe, vou te transferir para um especialista.",
    });

    await caseSolutionStorage.updateStatus(caseSolutionId, "escalated");

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "escalate",
      aiReason: reason,
      action: "escalated",
      details: { caseSolutionId },
    };

    return {
      success: true,
      solutionFound: false,
      caseSolutionId,
      escalated: true,
      error: reason,
    };
  }
}
