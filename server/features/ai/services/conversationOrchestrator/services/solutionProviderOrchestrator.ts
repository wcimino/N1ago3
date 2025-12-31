import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { summaryStorage } from "../../../storage/summaryStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { saveSuggestedResponse } from "../../agentFramework.js";
import { callOpenAI } from "../../openaiApiService.js";
import {
  selectNextAction,
  allActionsCompleted,
  decideActionExecution,
  getActionDescription,
  getActionAgentInstructions,
  resolveMessageFromVariations,
  type CaseAction,
  type ActionDecision,
} from "./actionStateMachine.js";
import type { ClientHubData } from "../../../../../../shared/schema/clientHub.js";
import { createAgentLogger } from "../helpers/orchestratorHelpers.js";

const MAX_INTERACTIONS = 5;
const log = createAgentLogger("SolutionProviderOrchestrator");

interface SolutionProviderAIResponse {
  mensagem?: string;
  motivo?: string;
}

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
    const { conversationId } = context;
    const action = decision.action;

    await caseSolutionStorage.updateActionStatus(action.id, "in_progress");

    switch (decision.decision) {
      case "transfer_to_human":
        return await this.executeTransferToHuman(context, caseSolutionId, action);

      case "execute_automatic":
        return await this.executeAutomaticAction(context, caseSolutionId, action);

      case "send_message_to_customer":
        return await this.executeSendMessageAction(context, caseSolutionId, action, false);

      case "ask_customer_for_input":
        return await this.executeSendMessageAction(context, caseSolutionId, action, true);

      case "execute_internal":
        return await this.executeInternalAction(context, caseSolutionId, action);

      case "skip_unknown":
        console.log(`[SolutionProviderOrchestrator] Skipping unknown action type`);
        await caseSolutionStorage.updateActionStatus(action.id, "skipped", {
          output: { reason: "Unknown action type" },
        });
        return {
          success: true,
          solutionFound: true,
          caseSolutionId,
          actionExecuted: "skipped",
          escalated: false,
        };

      default:
        return await this.escalate(context, caseSolutionId, `Unknown decision: ${decision.decision}`);
    }
  }

  private static async executeTransferToHuman(
    context: OrchestratorContext,
    caseSolutionId: number,
    action: CaseAction
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId } = context;

    console.log(`[SolutionProviderOrchestrator] Executing transfer to human`);

    const transferMessage = "Vou te transferir para um especialista que poderá te ajudar melhor.";
    const orchestratorAction: OrchestratorAction = {
      type: "TRANSFER_TO_HUMAN",
      payload: { reason: "Action requires human transfer", message: transferMessage },
    };

    await ActionExecutor.execute(context, [orchestratorAction]);

    await caseSolutionStorage.updateActionStatus(action.id, "completed", {
      output: { transferred: true },
    });
    await caseSolutionStorage.updateStatus(caseSolutionId, "escalated");

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "transfer_to_human",
      aiReason: "Action type requires human transfer",
      action: "transfer_to_human",
      details: { caseSolutionId, actionId: action.id },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "transfer_to_human",
      escalated: true,
      messageSent: true,
    };
  }

  private static async executeAutomaticAction(
    context: OrchestratorContext,
    caseSolutionId: number,
    action: CaseAction
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId, event } = context;
    console.log(`[SolutionProviderOrchestrator] Executing automatic action: consultar_perfil_cliente`);

    const clientHubData = await this.getClientHubData(context);

    if (clientHubData) {
      await caseSolutionStorage.updateCollectedInputs(caseSolutionId, undefined, {
        clientProfile: clientHubData,
      });
      
      await caseSolutionStorage.updateActionStatus(action.id, "completed", {
        output: { profileFound: true, dataKeys: Object.keys(clientHubData) },
      });
      
      console.log(`[SolutionProviderOrchestrator] Client profile found, action completed`);
    } else {
      await caseSolutionStorage.updateActionStatus(action.id, "completed", {
        output: { profileFound: false, reason: "No client data available" },
      });
      
      console.log(`[SolutionProviderOrchestrator] No client profile, marking as completed anyway`);
    }

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "automatic_action",
      aiReason: "Consultar perfil executed automatically",
      action: "consultar_perfil_cliente",
      details: { caseSolutionId, actionId: action.id, profileFound: !!clientHubData },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "consultar_perfil_cliente",
      escalated: false,
      waitingForCustomer: false,
      messageSent: false,
    };
  }

  private static async executeSendMessageAction(
    context: OrchestratorContext,
    caseSolutionId: number,
    action: CaseAction,
    waitForResponse: boolean
  ): Promise<SolutionProviderOrchestratorResult> {
    const { conversationId, event } = context;

    const actionDescription = getActionDescription(action);
    const agentInstructions = getActionAgentInstructions(action);
    const actionValue = (action.inputUsed as Record<string, unknown>)?.value as string | null ?? null;

    console.log(`[SolutionProviderOrchestrator] Generating message for action: ${actionDescription}`);

    const clientHubData = await this.getClientHubData(context);
    const resolvedMessage = resolveMessageFromVariations(action, clientHubData);

    if (resolvedMessage.variationLabel) {
      console.log(`[SolutionProviderOrchestrator] Using variation: ${resolvedMessage.variationLabel}`);
    }

    let mensagem: string;
    let suggestionId: number | undefined;

    if (resolvedMessage.message) {
      console.log(`[SolutionProviderOrchestrator] Using pre-defined message from action`);
      mensagem = resolvedMessage.message;

      const saved = await saveSuggestedResponse(conversationId, mensagem, {
        externalConversationId: event.externalConversationId,
        lastEventId: event.id,
        inResponseTo: String(event.id),
        source: "solution_provider_orchestrator_predefined",
      });
      suggestionId = saved?.id;
    } else {
      console.log(`[SolutionProviderOrchestrator] Calling AI to generate message`);

      const aiResult = await this.callAIForMessage(context, {
        actionDescription,
        actionValue,
        agentInstructions: resolvedMessage.agentInstructions ?? agentInstructions,
        waitForResponse,
      });

      if (!aiResult || !aiResult.mensagem) {
        console.log(`[SolutionProviderOrchestrator] AI failed to generate message, escalating`);
        return await this.escalate(context, caseSolutionId, "AI failed to generate message");
      }

      mensagem = aiResult.mensagem;
      suggestionId = aiResult.suggestionId;
    }

    if (!suggestionId) {
      const saved = await saveSuggestedResponse(conversationId, mensagem, {
        externalConversationId: event.externalConversationId,
        lastEventId: event.id,
        inResponseTo: String(event.id),
      });
      suggestionId = saved?.id;
    }

    if (!suggestionId) {
      console.log(`[SolutionProviderOrchestrator] Failed to save message, escalating`);
      return await this.escalate(context, caseSolutionId, "Failed to save message");
    }

    const sendAction: OrchestratorAction = {
      type: "SEND_MESSAGE",
      payload: { suggestionId, responsePreview: mensagem.substring(0, 100) },
    };
    await ActionExecutor.execute(context, [sendAction]);

    if (waitForResponse) {
      await caseSolutionStorage.updateActionStatus(action.id, "in_progress", {
        output: { messageSent: true, waitingForResponse: true },
      });

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
        conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
        waitingForCustomer: true,
      });

      context.lastDispatchLog = {
        solutionCenterResults: 1,
        aiDecision: "ask_customer",
        aiReason: "Waiting for customer response",
        action: "message_sent_waiting",
        details: { caseSolutionId, actionId: action.id, suggestionId },
      };

      return {
        success: true,
        solutionFound: true,
        caseSolutionId,
        actionExecuted: "ask_customer",
        escalated: false,
        waitingForCustomer: true,
        messageSent: true,
      };
    } else {
      await caseSolutionStorage.updateActionStatus(action.id, "completed", {
        output: { messageSent: true },
      });

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
        conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
        waitingForCustomer: false,
      });

      context.lastDispatchLog = {
        solutionCenterResults: 1,
        aiDecision: "inform_customer",
        aiReason: "Informed customer",
        action: "message_sent",
        details: { caseSolutionId, actionId: action.id, suggestionId },
      };

      return {
        success: true,
        solutionFound: true,
        caseSolutionId,
        actionExecuted: "inform_customer",
        escalated: false,
        waitingForCustomer: false,
        messageSent: true,
      };
    }
  }

  private static async executeInternalAction(
    context: OrchestratorContext,
    caseSolutionId: number,
    action: CaseAction
  ): Promise<SolutionProviderOrchestratorResult> {
    console.log(`[SolutionProviderOrchestrator] Executing internal action (marking as completed)`);

    await caseSolutionStorage.updateActionStatus(action.id, "completed", {
      output: { executedAsInternal: true, note: "Internal actions are marked complete automatically" },
    });

    context.lastDispatchLog = {
      solutionCenterResults: 0,
      aiDecision: "internal_action",
      aiReason: "Internal action executed",
      action: "internal_completed",
      details: { caseSolutionId, actionId: action.id },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "internal_action",
      escalated: false,
      waitingForCustomer: false,
      messageSent: false,
    };
  }

  private static async callAIForMessage(
    context: OrchestratorContext,
    actionInfo: {
      actionDescription: string;
      actionValue: string | null;
      agentInstructions: string | null;
      waitForResponse: boolean;
    }
  ): Promise<(SolutionProviderAIResponse & { suggestionId?: number }) | null> {
    const { conversationId, event } = context;

    const systemPrompt = `Você é um assistente de atendimento ao cliente. Gere uma mensagem clara e amigável.

REGRAS:
- Escreva em português brasileiro
- Seja cordial e objetivo
- NÃO invente informações
- Se precisa de resposta, faça UMA pergunta clara

Responda APENAS em JSON: {"mensagem": "texto", "motivo": "explicação breve"}`;

    const actionTypeLabel = actionInfo.waitForResponse ? "PERGUNTA" : "INFORMAÇÃO";
    const userPrompt = `AÇÃO A EXECUTAR (${actionTypeLabel}):
- Descrição: ${actionInfo.actionDescription}
${actionInfo.actionValue ? `- Valor/Conteúdo: ${actionInfo.actionValue}` : ""}
${actionInfo.agentInstructions ? `- Instruções: ${actionInfo.agentInstructions}` : ""}

Gere a mensagem para o cliente.`;

    console.log(`[SolutionProviderOrchestrator] Calling AI for message generation (minimal prompt)`);

    const result = await callOpenAI({
      requestType: "solution_provider_message",
      modelName: "gpt-4o-mini",
      promptSystem: systemPrompt,
      promptUser: userPrompt,
      maxTokens: 500,
      contextType: "conversation",
      contextId: String(conversationId),
    });

    if (!result.success || !result.responseContent) {
      console.log(`[SolutionProviderOrchestrator] AI call failed: ${result.error}`);
      return null;
    }

    try {
      const jsonMatch = result.responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`[SolutionProviderOrchestrator] No JSON in AI response`);
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as SolutionProviderAIResponse;
      if (!parsed.mensagem) {
        console.log(`[SolutionProviderOrchestrator] AI response missing 'mensagem'`);
        return null;
      }

      const saved = await saveSuggestedResponse(conversationId, parsed.mensagem, {
        externalConversationId: event.externalConversationId,
        lastEventId: event.id,
        openaiLogId: result.logId,
        inResponseTo: String(event.id),
        source: "solution_provider_orchestrator",
      });

      return {
        mensagem: parsed.mensagem,
        motivo: parsed.motivo,
        suggestionId: saved?.id,
      };
    } catch (parseError) {
      console.error(`[SolutionProviderOrchestrator] Failed to parse AI response:`, parseError);
      return null;
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

    const { escalateConversation } = await import("../helpers/orchestratorHelpers.js");
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

  private static async getClientHubData(
    context: OrchestratorContext
  ): Promise<ClientHubData | null> {
    const { conversationId, event } = context;

    if (event.externalConversationId) {
      const existingSummary = await summaryStorage.getConversationSummaryByExternalId(event.externalConversationId);
      if (existingSummary?.clientHubData) {
        return existingSummary.clientHubData as ClientHubData;
      }
    }

    if (conversationId) {
      const clientHubData = await summaryStorage.getClientHubData(conversationId);
      return clientHubData as ClientHubData | null;
    }

    return null;
  }
}
