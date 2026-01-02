import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { ActionExecutor, type ActionExecutorResult } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";

const CONFIG_KEY = "closer";
export const DEFAULT_CLOSING_MESSAGE = "Obrigado por entrar em contato! Tenha um otimo dia!";
export const DEFAULT_MORE_HELP_PROMPT = "Claro! Em que posso te ajudar agora?";
export const DEFAULT_FOLLOW_UP_MESSAGE = "Posso te ajudar com mais alguma coisa?";

export interface CloserProcessResult {
  success: boolean;
  wantsMoreHelp: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class CloserAgent {
  static async process(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, currentStatus } = context;

    // Distinguir entre primeira chamada (enviar follow-up) e segunda chamada (processar resposta)
    const isProcessingCustomerResponse = currentStatus === ORCHESTRATOR_STATUS.FINALIZING;

    console.log(`[CloserAgent] Processing conversation ${conversationId}, mode: ${isProcessingCustomerResponse ? "processing_response" : "sending_followup"}`);

    if (isProcessingCustomerResponse) {
      return this.processCustomerResponse(context);
    } else {
      return this.sendFollowUp(context);
    }
  }

  /**
   * Primeira chamada: Envia follow-up "Te ajudo com mais alguma coisa?"
   * Após enviar, mantém FINALIZING e waitingForCustomer=true
   */
  private static async sendFollowUp(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserAgent] Sending follow-up for conversation ${conversationId}`);

      const followUpMessage = DEFAULT_FOLLOW_UP_MESSAGE;
      const savedSuggestion = await saveSuggestedResponse(conversationId, followUpMessage, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });

      if (!savedSuggestion?.id) {
        console.log(`[CloserAgent] Failed to save follow-up suggestion, keeping conversation open`);
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
          conversationOwner: CONVERSATION_OWNER.CLOSER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
        return {
          success: true,
          wantsMoreHelp: false,
          error: "Failed to save follow-up suggestion",
        };
      }

      // Tentar enviar o follow-up
      const action: OrchestratorAction = {
        type: "SEND_MESSAGE",
        payload: { suggestionId: savedSuggestion.id, responsePreview: followUpMessage }
      };
      const sendResult = await ActionExecutor.execute(context, [action]);

      // Independente de ter enviado ou não, mantém FINALIZING aguardando resposta do cliente
      console.log(`[CloserAgent] Follow-up ${sendResult.messageSent ? "sent" : "not sent"} (reason: ${sendResult.skipReason}), waiting for customer response`);

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
        conversationOwner: CONVERSATION_OWNER.CLOSER,
        waitingForCustomer: true,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

      return {
        success: true,
        wantsMoreHelp: false,
        suggestedResponse: followUpMessage,
        suggestionId: savedSuggestion.id,
      };

    } catch (error: any) {
      console.error(`[CloserAgent] Error sending follow-up for conversation ${conversationId}:`, error);
      
      // Em caso de erro, mantém FINALIZING aguardando resposta
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
        conversationOwner: CONVERSATION_OWNER.CLOSER,
        waitingForCustomer: true,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

      return {
        success: true,
        wantsMoreHelp: false,
        error: error.message || "Error sending follow-up",
      };
    }
  }

  /**
   * Segunda chamada: Processa resposta do cliente ao follow-up
   * Usa IA para determinar se cliente quer mais ajuda ou está satisfeito
   */
  private static async processCustomerResponse(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserAgent] Analyzing customer response for conversation ${conversationId}`);

      const resolvedClassification = await buildResolvedClassification(context.classification);

      const agentContext = await buildAgentContextFromEvent(event, {
        overrides: {
          summary: context.summary,
          classification: resolvedClassification,
        },
      });

      const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o-mini",
        suggestionField: "suggestedResponse",
        inResponseTo: String(event.id),
      });

      if (!result.success) {
        console.log(`[CloserAgent] Agent call failed for conversation ${conversationId}: ${result.error}, using fallback`);
        return this.handleFallbackClose(context, DEFAULT_CLOSING_MESSAGE);
      }

      const wantsMoreHelp = result.parsedContent?.wantsMoreHelp === true;
      let suggestedResponse = result.parsedContent?.suggestedResponse as string | undefined;
      let suggestionId = result.suggestionId;

      if (!suggestedResponse) {
        suggestedResponse = wantsMoreHelp ? DEFAULT_MORE_HELP_PROMPT : DEFAULT_CLOSING_MESSAGE;
      }

      if (!suggestionId) {
        const savedSuggestion = await saveSuggestedResponse(conversationId, suggestedResponse, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        suggestionId = savedSuggestion?.id;
      }

      console.log(`[CloserAgent] Analysis complete - wantsMoreHelp: ${wantsMoreHelp}`);

      // Enviar resposta
      let sendResult: ActionExecutorResult = { messageSent: false, messageSkipped: false };
      if (suggestionId && suggestedResponse) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId, responsePreview: suggestedResponse }
        };
        sendResult = await ActionExecutor.execute(context, [action]);
      }

      // Se a mensagem não foi enviada, mantém FINALIZING aguardando
      if (!sendResult.messageSent) {
        console.log(`[CloserAgent] Response not sent (reason: ${sendResult.skipReason}), keeping conversation open for ${conversationId}`);
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
          conversationOwner: CONVERSATION_OWNER.CLOSER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
      } else if (wantsMoreHelp) {
        // Cliente quer mais ajuda - inicia novo ciclo de demanda
        console.log(`[CloserAgent] Customer wants more help, creating new demand`);

        const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
        console.log(`[CloserAgent] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINDING_DEMAND,
          conversationOwner: CONVERSATION_OWNER.DEMAND_FINDER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
      } else {
        // Cliente está satisfeito e mensagem foi enviada - fecha a conversa
        console.log(`[CloserAgent] Customer satisfied, closing conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.CLOSED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
      }

      return {
        success: true,
        wantsMoreHelp,
        suggestedResponse,
        suggestionId,
      };

    } catch (error: any) {
      console.error(`[CloserAgent] Error processing customer response for conversation ${conversationId}:`, error);
      return this.handleFallbackClose(context, DEFAULT_CLOSING_MESSAGE);
    }
  }

  /**
   * Fallback: Envia mensagem de fechamento e fecha a conversa
   */
  private static async handleFallbackClose(context: OrchestratorContext, message: string): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      const savedSuggestion = await saveSuggestedResponse(conversationId, message, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });

      if (savedSuggestion?.id) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: savedSuggestion.id, responsePreview: message }
        };
        await ActionExecutor.execute(context, [action]);
      }

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.CLOSED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;

      return {
        success: true,
        wantsMoreHelp: false,
        suggestedResponse: message,
        suggestionId: savedSuggestion?.id,
      };
    } catch (recoveryError) {
      console.error(`[CloserAgent] Fallback close failed for conversation ${conversationId}:`, recoveryError);
      return {
        success: false,
        wantsMoreHelp: false,
        error: "Failed to close conversation",
      };
    }
  }
}
