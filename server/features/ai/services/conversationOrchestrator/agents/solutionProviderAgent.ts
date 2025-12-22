import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { getSolutionFromCenter, type SolutionProviderResponse, type SolutionProviderAction } from "../../../../../shared/services/solutionCenterClient.js";

export interface SolutionProviderProcessResult {
  success: boolean;
  solutionFound: boolean;
  caseSolutionId?: number;
  actionExecuted?: string;
  escalated: boolean;
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

      const solutionResponse = await this.resolveSolution(caseSolution.id, {
        articleId: articleUuid,
        problemId,
        rootCauseId: rootCauseUuid,
      });

      if (!solutionResponse) {
        console.log(`[SolutionProviderAgent] No solution found, using fallback (transfer to human)`);
        return await this.executeFallback(context, caseSolution.id);
      }

      await this.createActionsFromResponse(caseSolution.id, solutionResponse.actions);

      console.log(`[SolutionProviderAgent] Solution found: ${solutionResponse.solution.name}`);
      return await this.executeSolution(context, caseSolution.id, solutionResponse);

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

  private static async resolveSolution(
    caseSolutionId: number,
    inputs: { articleId?: string; problemId?: string; solutionId?: number; rootCauseId?: string }
  ): Promise<SolutionProviderResponse | null> {
    console.log(`[SolutionProviderAgent] Resolving solution for case_solution ${caseSolutionId}`);
    console.log(`[SolutionProviderAgent] Inputs: articleId=${inputs.articleId}, problemId=${inputs.problemId}, rootCauseId=${inputs.rootCauseId}`);
    
    if (!inputs.articleId || !inputs.problemId || !inputs.rootCauseId) {
      console.log(`[SolutionProviderAgent] Missing required inputs for Central de Soluções API`);
      return null;
    }

    const response = await getSolutionFromCenter({
      articleId: inputs.articleId,
      problemId: inputs.problemId,
      rootCauseId: inputs.rootCauseId,
    });

    if (!response || !response.solution) {
      console.log(`[SolutionProviderAgent] No solution returned from Central de Soluções`);
      return null;
    }

    return response;
  }

  private static async createActionsFromResponse(
    caseSolutionId: number,
    actions: SolutionProviderAction[]
  ): Promise<void> {
    console.log(`[SolutionProviderAgent] Creating ${actions.length} actions for case_solution ${caseSolutionId}`);

    const sortedActions = [...actions].sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      await caseSolutionStorage.createAction({
        caseSolutionId,
        actionId: 0,
        actionSequence: action.order,
        status: "pending",
        inputUsed: {
          externalId: action.id,
          name: action.name,
          description: action.description,
          actionType: action.actionType,
          actionValue: action.actionValue,
          source: "central_de_solucoes",
        },
      });
      console.log(`[SolutionProviderAgent] Created action: ${action.name} (type: ${action.actionType}, order: ${action.order})`);
    }
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

  private static async executeSolution(
    context: OrchestratorContext,
    caseSolutionId: number,
    solutionResponse: SolutionProviderResponse
  ): Promise<SolutionProviderProcessResult> {
    const { conversationId } = context;
    const { solution, actions } = solutionResponse;

    console.log(`[SolutionProviderAgent] Executing solution ${solution.name} for conversation ${conversationId}`);
    console.log(`[SolutionProviderAgent] Solution has ${actions.length} actions to execute`);

    await caseSolutionStorage.updateStatus(caseSolutionId, "in_progress");

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
      conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;

    context.lastDispatchLog = {
      solutionCenterResults: 1,
      aiDecision: "solution_found",
      aiReason: `Solution "${solution.name}" found with ${actions.length} actions`,
      action: "solution_applied",
      details: { 
        caseSolutionId, 
        solutionId: solution.id,
        solutionName: solution.name,
        actionsCount: actions.length,
      },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: solution.name,
      escalated: false,
    };
  }

  private static async escalateConversation(
    conversationId: number,
    context: OrchestratorContext,
    reason: string
  ): Promise<void> {
    console.log(`[SolutionProviderAgent] Escalating conversation ${conversationId}: ${reason}`);

    const escalationMessage = "Desculpe, tivemos um problema técnico. Vou te transferir para um especialista.";
    const action: OrchestratorAction = {
      type: "TRANSFER_TO_HUMAN",
      payload: { reason, message: escalationMessage }
    };
    
    await ActionExecutor.execute(context, [action]);

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;

    if (context.caseSolutionId) {
      await caseSolutionStorage.updateStatus(context.caseSolutionId, "error");
    }
  }
}
