import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { getSolutionFromCenter, type SolutionProviderResponse } from "../../../../../shared/services/solutionCenterClient.js";

type RawAction = Record<string, unknown>;

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
      const createdActions = await this.createActionsFromResponse(caseSolution.id, actions);

      const solutionName = this.getSolutionName(solutionResponse);
      console.log(`[SolutionProviderAgent] Solution found: ${solutionName}`);
      return await this.executeSolution(context, caseSolution.id, solutionResponse, createdActions);

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

  private static getSolutionId(response: SolutionProviderResponse): string {
    const solution = response.solution;
    if (!solution) return "";
    return String(solution.id || "");
  }

  private static async resolveSolution(
    caseSolutionId: number,
    conversationId: number,
    inputs: { articleId?: string; problemId?: string; solutionId?: number; rootCauseId?: string }
  ): Promise<SolutionProviderResponse | null> {
    console.log(`[SolutionProviderAgent] Resolving solution for case_solution ${caseSolutionId}`);
    console.log(`[SolutionProviderAgent] Inputs: articleId=${inputs.articleId}, problemId=${inputs.problemId}, rootCauseId=${inputs.rootCauseId}`);
    
    if (!inputs.articleId || !inputs.problemId || !inputs.rootCauseId) {
      console.log(`[SolutionProviderAgent] Missing required inputs for Central de Soluções API`);
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

  private static mapToOrchestratorActions(
    createdActions: Array<{ caseActionId: number; rawAction: RawAction }>
  ): OrchestratorAction[] {
    return createdActions.map(({ caseActionId, rawAction }) => {
      const actionType = String(rawAction.actionType || "");
      const name = String(rawAction.name || rawAction.description || "Action");
      const description = String(rawAction.description || "");
      const actionValue = String(rawAction.actionValue || "");
      const filledInputs = rawAction.filledInputs as Record<string, unknown> | undefined;
      const answer = filledInputs?.answer ? String(filledInputs.answer) : actionValue;
      const agentInstructions = rawAction.agentInstructions ? String(rawAction.agentInstructions) : undefined;
      
      switch (actionType) {
        case "instruction":
          return {
            type: "INSTRUCTION" as const,
            payload: {
              caseActionId,
              name,
              description,
              value: answer,
              agentInstructions,
            },
          };
        case "informar_cliente":
          return {
            type: "INSTRUCTION" as const,
            payload: {
              caseActionId,
              name,
              description,
              value: answer,
              agentInstructions,
            },
          };
        case "link":
          return {
            type: "LINK" as const,
            payload: {
              caseActionId,
              name,
              description,
              url: actionValue,
              agentInstructions,
            },
          };
        case "api_call":
          return {
            type: "API_CALL" as const,
            payload: {
              caseActionId,
              name,
              description,
              endpoint: actionValue,
              agentInstructions,
            },
          };
        default:
          console.warn(`[SolutionProviderAgent] Unknown action type: ${actionType}, treating as instruction`);
          return {
            type: "INSTRUCTION" as const,
            payload: {
              caseActionId,
              name,
              description,
              value: answer,
              agentInstructions,
            },
          };
      }
    });
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
    solutionResponse: SolutionProviderResponse,
    createdActions: Array<{ caseActionId: number; rawAction: RawAction }>
  ): Promise<SolutionProviderProcessResult> {
    const { conversationId } = context;
    const solutionName = this.getSolutionName(solutionResponse);
    const solutionId = this.getSolutionId(solutionResponse);
    const actionsCount = solutionResponse.actions?.length || 0;

    console.log(`[SolutionProviderAgent] Executing solution ${solutionName} for conversation ${conversationId}`);
    console.log(`[SolutionProviderAgent] Solution has ${actionsCount} actions to execute`);

    await caseSolutionStorage.updateStatus(caseSolutionId, "in_progress");

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
      conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;

    const orchestratorActions = this.mapToOrchestratorActions(createdActions);
    
    if (orchestratorActions.length > 0) {
      console.log(`[SolutionProviderAgent] Executing ${orchestratorActions.length} orchestrator actions`);
      
      for (const { caseActionId } of createdActions) {
        await caseSolutionStorage.updateActionStatus(caseActionId, "in_progress");
      }
      
      await ActionExecutor.execute(context, orchestratorActions);
      
      for (const { caseActionId } of createdActions) {
        await caseSolutionStorage.updateActionStatus(caseActionId, "completed", {
          output: { executedAt: new Date().toISOString() },
        });
      }
      
      await caseSolutionStorage.updateStatus(caseSolutionId, "resolved");
      
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
        conversationOwner: CONVERSATION_OWNER.CLOSER,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
    }

    context.lastDispatchLog = {
      solutionCenterResults: 1,
      aiDecision: "solution_found",
      aiReason: `Solution "${solutionName}" found with ${actionsCount} actions`,
      action: "solution_applied",
      details: { 
        caseSolutionId, 
        solutionId,
        solutionName,
        actionsCount,
        actionsExecuted: orchestratorActions.length,
      },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: solutionName,
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
