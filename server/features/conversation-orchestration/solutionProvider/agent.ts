import { conversationStorage } from "../../conversations/storage/conversationStorage.js";
import { caseSolutionStorage } from "../../ai/storage/caseSolutionStorage.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../shared/types.js";
import { ActionExecutor } from "../shared/actionExecutor.js";
import { escalateConversation } from "../shared/escalation.js";
import { getSolutionFromCenter, type SolutionProviderResponse } from "../../../shared/services/solutionCenterClient.js";
import { SolutionProviderOrchestrator } from "./orchestrator.js";
import type { CaseAction } from "./stateMachine.js";

type RawAction = Record<string, unknown>;

export interface SolutionProviderProcessResult {
  success: boolean;
  solutionFound: boolean;
  caseSolutionId?: number;
  actionExecuted?: string;
  escalated: boolean;
  waitingForCustomer?: boolean;
  messageSent?: boolean;
  error?: string;
}

export class SolutionProviderAgent {
  static async process(context: OrchestratorContext): Promise<SolutionProviderProcessResult> {
    const { conversationId, articleId, solutionId, rootCauseId, problemId, articleUuid, rootCauseUuid } = context;

    try {
      console.log(`[SolutionProviderAgent] Starting solution provision for conversation ${conversationId}`);
      console.log(`[SolutionProviderAgent] Received: articleId=${articleId}, solutionId=${solutionId}, rootCauseId=${rootCauseId}`);
      console.log(`[SolutionProviderAgent] UUIDs: articleUuid=${articleUuid}, problemId=${problemId}, rootCauseUuid=${rootCauseUuid}`);

      let caseSolution = await caseSolutionStorage.getActiveByConversationId(conversationId);
      let existingActions: CaseAction[] = caseSolution ? await caseSolutionStorage.getActions(caseSolution.id) : [];
      
      if (!caseSolution) {
        console.log(`[SolutionProviderAgent] Creating new case_solution for conversation ${conversationId}`);
        caseSolution = await caseSolutionStorage.createForConversation(conversationId, {
          solutionId,
          rootCauseId,
          articleId,
        });
        console.log(`[SolutionProviderAgent] Created case_solution ${caseSolution.id}`);
      }

      context.caseSolutionId = caseSolution.id;

      if (existingActions.length === 0) {
        const solutionResponse = await this.resolveSolution(caseSolution.id, conversationId, {
          articleId: articleUuid,
          problemId,
          rootCauseId: rootCauseUuid,
        });

        if (!solutionResponse) {
          console.log(`[SolutionProviderAgent] No solution found, using fallback (transfer to human)`);
          return await this.executeFallback(context, caseSolution.id);
        }

        const actions = solutionResponse.actions || [];
        
        if (actions.length === 0) {
          const solutionName = this.getSolutionName(solutionResponse);
          console.log(`[SolutionProviderAgent] Solution "${solutionName}" has no actions, using fallback (transfer to human)`);
          return await this.executeFallback(context, caseSolution.id);
        }
        
        await this.createActionsFromResponse(caseSolution.id, actions);
        existingActions = await caseSolutionStorage.getActions(caseSolution.id);
        
        const solutionName = this.getSolutionName(solutionResponse);
        console.log(`[SolutionProviderAgent] Solution found: ${solutionName}, created ${existingActions.length} actions`);
      } else {
        console.log(`[SolutionProviderAgent] Resuming with ${existingActions.length} existing actions`);
      }

      await caseSolutionStorage.updateStatus(caseSolution.id, "in_progress");

      const result = await SolutionProviderOrchestrator.process(context, caseSolution.id, existingActions);

      if (result.waitingForCustomer === false && !result.escalated && result.success) {
        const updatedActions = await caseSolutionStorage.getActions(caseSolution.id);
        const allCompleted = updatedActions.every(a => a.status === "completed" || a.status === "skipped");
        
        if (allCompleted) {
          console.log(`[SolutionProviderAgent] All actions completed, transitioning to Closer`);
          await caseSolutionStorage.updateStatus(caseSolution.id, "resolved");
          await conversationStorage.updateOrchestratorState(conversationId, {
            orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
            conversationOwner: CONVERSATION_OWNER.CLOSER,
            waitingForCustomer: false,
          });
          context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
        }
      }

      return result;

    } catch (error: any) {
      console.error(`[SolutionProviderAgent] Error processing conversation ${conversationId}:`, error);
      
      try {
        await this.escalateConversation(conversationId, context, error.message || "Solution provider error");
      } catch (escalationError) {
        console.error(`[SolutionProviderAgent] Failed to escalate:`, escalationError);
      }
      
      return {
        success: false,
        solutionFound: false,
        escalated: true,
        error: error.message || "Failed to process solution provider",
      };
    }
  }

  private static getSolutionName(response: SolutionProviderResponse): string {
    const solution = response.solution;
    if (!solution) return "Unknown";
    return String(solution.name || solution.id || "Unknown");
  }

  private static async resolveSolution(
    caseSolutionId: number,
    conversationId: number,
    inputs: { articleId?: string; problemId?: string; solutionId?: number; rootCauseId?: string }
  ): Promise<SolutionProviderResponse | null> {
    console.log(`[SolutionProviderAgent] Resolving solution for case_solution ${caseSolutionId}`);
    console.log(`[SolutionProviderAgent] Inputs: articleId=${inputs.articleId}, problemId=${inputs.problemId}, rootCauseId=${inputs.rootCauseId}`);
    
    if (!inputs.articleId && !inputs.problemId) {
      console.log(`[SolutionProviderAgent] Need at least articleId or problemId for Central de Soluções API`);
      return null;
    }

    const response = await getSolutionFromCenter(
      {
        articleId: inputs.articleId,
        problemId: inputs.problemId,
        rootCauseId: inputs.rootCauseId,
      },
      {
        caseSolutionId,
        conversationId,
      }
    );

    if (!response || !response.solution) {
      console.log(`[SolutionProviderAgent] No solution returned from Central de Soluções`);
      return null;
    }

    if (response.success === false) {
      console.log(`[SolutionProviderAgent] API returned success=false`);
      return null;
    }

    return response;
  }

  private static async createActionsFromResponse(
    caseSolutionId: number,
    actions: Array<RawAction>
  ): Promise<Array<{ caseActionId: number; rawAction: RawAction }>> {
    console.log(`[SolutionProviderAgent] Creating ${actions.length} actions for case_solution ${caseSolutionId}`);

    const sortedActions = [...actions].sort((a, b) => {
      const seqA = Number(a.sequence || a.order || 0);
      const seqB = Number(b.sequence || b.order || 0);
      return seqA - seqB;
    });
    
    const createdActions: Array<{ caseActionId: number; rawAction: RawAction }> = [];

    for (const rawAction of sortedActions) {
      const sequence = Number(rawAction.sequence || rawAction.order || 0);
      const externalActionId = String(rawAction.actionId || rawAction.id || "") || null;
      
      const caseAction = await caseSolutionStorage.createAction({
        caseSolutionId,
        actionId: 0,
        externalActionId,
        actionSequence: sequence,
        status: "pending",
        inputUsed: {
          ...rawAction,
          source: "central_de_solucoes",
        },
      });
      
      createdActions.push({ caseActionId: caseAction.id, rawAction });
      
      const actionType = rawAction.actionType || "unknown";
      console.log(`[SolutionProviderAgent] Created action: ${externalActionId} (type: ${actionType}, sequence: ${sequence})`);
    }

    return createdActions;
  }

  private static async executeFallback(
    context: OrchestratorContext,
    caseSolutionId: number
  ): Promise<SolutionProviderProcessResult> {
    const { conversationId } = context;

    console.log(`[SolutionProviderAgent] Executing fallback action for conversation ${conversationId}`);

    const fallbackAction = await caseSolutionStorage.createFallbackAction(caseSolutionId);
    console.log(`[SolutionProviderAgent] Created fallback action ${fallbackAction.id}`);

    await caseSolutionStorage.updateActionStatus(fallbackAction.id, "in_progress");

    const transferMessage = "Vou te transferir para um especialista que poderá te ajudar melhor com essa solicitação.";
    const action: OrchestratorAction = {
      type: "TRANSFER_TO_HUMAN",
      payload: { 
        reason: "No solution available - fallback transfer",
        message: transferMessage
      }
    };

    await ActionExecutor.execute(context, [action]);

    await caseSolutionStorage.updateActionStatus(fallbackAction.id, "completed", {
      output: { transferred: true, reason: "fallback" }
    });
    await caseSolutionStorage.updateStatus(caseSolutionId, "escalated");

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "fallback",
      aiReason: "No solution found in Central de Soluções",
      action: "transfer_to_human",
      details: { caseSolutionId, fallbackActionId: fallbackAction.id },
    };

    console.log(`[SolutionProviderAgent] Fallback executed, conversation ${conversationId} escalated`);

    return {
      success: true,
      solutionFound: false,
      caseSolutionId,
      actionExecuted: "transfer_to_human",
      escalated: true,
    };
  }

  private static async escalateConversation(
    conversationId: number,
    context: OrchestratorContext,
    reason: string
  ): Promise<void> {
    await escalateConversation(conversationId, context, reason, {
      sendApologyMessage: true,
      apologyMessage: "Desculpe, tivemos um problema técnico. Vou te transferir para um especialista.",
      updateCaseDemandStatus: false,
    });

    if (context.caseSolutionId) {
      await caseSolutionStorage.updateStatus(context.caseSolutionId, "error");
    }
  }
}
