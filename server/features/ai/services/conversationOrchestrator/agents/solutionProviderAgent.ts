import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";

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
    const { conversationId, articleId, solutionId, rootCauseId } = context;

    try {
      console.log(`[SolutionProviderAgent] Starting solution provision for conversation ${conversationId}`);
      console.log(`[SolutionProviderAgent] Received: articleId=${articleId}, solutionId=${solutionId}, rootCauseId=${rootCauseId}`);

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

      const solution = await this.resolveSolution(caseSolution.id, {
        articleId,
        solutionId,
        rootCauseId,
      });

      if (!solution) {
        console.log(`[SolutionProviderAgent] No solution found, using fallback (transfer to human)`);
        return await this.executeFallback(context, caseSolution.id);
      }

      console.log(`[SolutionProviderAgent] Solution found: ${solution.type}`);
      return await this.executeSolution(context, caseSolution.id, solution);

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
    inputs: { articleId?: number; solutionId?: number; rootCauseId?: number }
  ): Promise<{ type: string; actions: string[] } | null> {
    console.log(`[SolutionProviderAgent] Resolving solution for case_solution ${caseSolutionId}`);
    console.log(`[SolutionProviderAgent] Inputs: articleId=${inputs.articleId}, solutionId=${inputs.solutionId}, rootCauseId=${inputs.rootCauseId}`);
    
    // TODO: Implement Central de Soluções API integration
    // When the API is ready, this method should:
    // 1. Query the Central de Soluções for the solution based on articleId or (solutionId + rootCauseId)
    // 2. Return the solution with its actions to execute
    // 3. For now, we always return null to use the fallback (transfer to human)
    
    // Example of future implementation:
    // if (inputs.articleId) {
    //   const solution = await solutionCenterAPI.getSolutionByArticle(inputs.articleId);
    //   if (solution) return { type: solution.type, actions: solution.actions };
    // }
    // if (inputs.solutionId && inputs.rootCauseId) {
    //   const solution = await solutionCenterAPI.getSolutionByRootCause(inputs.rootCauseId, inputs.solutionId);
    //   if (solution) return { type: solution.type, actions: solution.actions };
    // }
    
    return null;
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
    solution: { type: string; actions: string[] }
  ): Promise<SolutionProviderProcessResult> {
    const { conversationId } = context;

    console.log(`[SolutionProviderAgent] Executing solution ${solution.type} for conversation ${conversationId}`);

    await caseSolutionStorage.updateStatus(caseSolutionId, "resolved");

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
      conversationOwner: CONVERSATION_OWNER.CLOSER,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "solution_executed",
      aiReason: `Solution ${solution.type} executed successfully`,
      action: "solution_applied",
      details: { caseSolutionId, solutionType: solution.type },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: solution.type,
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
