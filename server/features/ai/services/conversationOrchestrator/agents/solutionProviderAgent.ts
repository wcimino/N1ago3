import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { caseActionsStorage } from "../../../storage/caseActionsStorage.js";
import type { SolutionProviderAgentResult, OrchestratorContext } from "../types.js";
import type { CaseSolutionWithDetails } from "../../../storage/caseSolutionStorage.js";
import type { CaseActionWithDetails } from "../../../storage/caseActionsStorage.js";
import { ACTION_TYPE_VALUES } from "@shared/constants/actionTypes";

const CONFIG_KEY = "solution_provider";

export class SolutionProviderAgent {
  static async process(context: OrchestratorContext): Promise<SolutionProviderAgentResult> {
    const { event, conversationId, summary, classification, demand, searchResults, rootCauseId, providedInputs } = context;

    try {
      console.log(`[SolutionProviderAgent] Processing conversation ${conversationId}`);
      console.log(`[SolutionProviderAgent] rootCauseId: ${rootCauseId}, providedInputs: ${JSON.stringify(providedInputs)}`);

      let caseSolution = await caseSolutionStorage.getActiveByConversationId(conversationId);

      if (!caseSolution && rootCauseId) {
        caseSolution = await this.createCaseSolution(context);
        console.log(`[SolutionProviderAgent] Created case solution ${caseSolution.id}`);
        context.caseSolutionId = caseSolution.id;
      }

      if (caseSolution) {
        if (providedInputs && Object.keys(providedInputs).length > 0) {
          await caseSolutionStorage.updateCollectedInputsCustomer(caseSolution.id, providedInputs);
          console.log(`[SolutionProviderAgent] Updated collected inputs for case solution ${caseSolution.id}`);
        }

        const caseSolutionWithDetails = await caseSolutionStorage.getByIdWithDetails(caseSolution.id);
        if (caseSolutionWithDetails) {
          const analysisResult = await this.analyzeAndProgress(caseSolutionWithDetails);
          if (analysisResult.suggestedResponse) {
            return {
              success: true,
              ...analysisResult,
            };
          }
        }
      }

      const resolvedClassification = await buildResolvedClassification(classification);

      const agentContext = await buildAgentContextFromEvent(event, {
        overrides: {
          summary,
          classification: resolvedClassification,
          demand,
          searchResults,
        },
      });

      const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o",
        suggestionField: "suggestedResponse",
      });

      if (!result.success) {
        return {
          success: false,
          resolved: false,
          needsEscalation: true,
          error: result.error || "Failed to run solution provider",
        };
      }

      if (!result.responseContent) {
        console.log(`[SolutionProviderAgent] No response for conversation ${conversationId}`);
        return {
          success: true,
          resolved: false,
          needsEscalation: false,
        };
      }

      const parsedContent = result.parsedContent;

      console.log(`[SolutionProviderAgent] Processed conversation ${conversationId}, resolved: ${parsedContent.resolved}, suggestionId: ${result.suggestionId || 'none'}`);

      return {
        success: true,
        resolved: parsedContent.resolved ?? true,
        solution: parsedContent.solution,
        confidence: parsedContent.confidence,
        needsEscalation: parsedContent.needsEscalation ?? false,
        escalationReason: parsedContent.escalationReason,
        suggestedResponse: parsedContent.suggestedResponse,
        suggestionId: result.suggestionId,
      };
    } catch (error: any) {
      console.error(`[SolutionProviderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        resolved: false,
        needsEscalation: true,
        error: error.message || "Failed to provide solution",
      };
    }
  }

  private static async createCaseSolution(context: OrchestratorContext): Promise<CaseSolutionWithDetails> {
    const { conversationId, rootCauseId, providedInputs } = context;

    const caseSolution = await caseSolutionStorage.createWithActions({
      conversationId,
      rootCauseId: rootCauseId || null,
      solutionId: null,
      status: "pending_info",
      providedInputs: providedInputs || {},
      collectedInputsCustomer: {},
      collectedInputsSystems: {},
      pendingInputs: [],
    });

    return caseSolution;
  }

  private static async analyzeAndProgress(caseSolution: CaseSolutionWithDetails): Promise<Omit<SolutionProviderAgentResult, "success">> {
    const nextAction = await caseActionsStorage.getNextPendingAction(caseSolution.id);

    if (!nextAction) {
      await caseSolutionStorage.updateStatus(caseSolution.id, "completed");
      console.log(`[SolutionProviderAgent] All actions completed for case solution ${caseSolution.id}`);
      return {
        resolved: true,
        solution: caseSolution.solution?.name,
        needsEscalation: false,
        suggestedResponse: "Sua solicitacao foi processada com sucesso!",
      };
    }

    const allInputs = this.getAllInputs(caseSolution);
    const actionType = nextAction.action?.actionType;

    if (actionType === ACTION_TYPE_VALUES.INFORM_CUSTOMER) {
      return await this.executeInformCustomerAction(caseSolution, nextAction, allInputs);
    }

    const missingInputs = this.getMissingInputs(nextAction, allInputs);

    if (missingInputs.length > 0) {
      await caseSolutionStorage.updateStatus(caseSolution.id, "pending_info");
      await caseSolutionStorage.updatePendingInputs(caseSolution.id, missingInputs);
      
      const question = this.buildInputQuestion(missingInputs[0], nextAction);
      console.log(`[SolutionProviderAgent] Missing inputs for action ${nextAction.actionId}: ${missingInputs.map(i => i.key).join(", ")}`);
      
      return {
        resolved: false,
        needsEscalation: false,
        suggestedResponse: question,
      };
    }

    await caseSolutionStorage.updateStatus(caseSolution.id, "executing");
    await caseActionsStorage.startAction(nextAction.id, allInputs);
    
    console.log(`[SolutionProviderAgent] Executing action ${nextAction.actionId} for case solution ${caseSolution.id}`);

    const response = this.buildActionResponse(nextAction, allInputs);
    
    await caseActionsStorage.completeAction(nextAction.id, { executedAt: new Date().toISOString() });

    return {
      resolved: false,
      needsEscalation: false,
      suggestedResponse: response,
    };
  }

  private static escapeRegexKey(key: string): string {
    return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static async executeInformCustomerAction(
    caseSolution: CaseSolutionWithDetails,
    action: CaseActionWithDetails,
    allInputs: Record<string, unknown>
  ): Promise<Omit<SolutionProviderAgentResult, "success">> {
    console.log(`[SolutionProviderAgent] Executing INFORM_CUSTOMER action ${action.actionId} for case solution ${caseSolution.id}`);

    await caseSolutionStorage.updateStatus(caseSolution.id, "executing");
    await caseActionsStorage.startAction(action.id, allInputs);

    const messageTemplate = action.action?.messageTemplate;
    if (!messageTemplate) {
      await caseActionsStorage.failAction(action.id, "Message template not configured");
      await caseSolutionStorage.updateStatus(caseSolution.id, "error");
      console.log(`[SolutionProviderAgent] No message template for action ${action.actionId}`);
      return {
        resolved: false,
        needsEscalation: true,
      };
    }

    let message = messageTemplate;
    for (const [key, value] of Object.entries(allInputs)) {
      const escapedKey = this.escapeRegexKey(key);
      message = message.replace(new RegExp(`\\{${escapedKey}\\}`, "g"), String(value));
    }

    await caseActionsStorage.completeAction(action.id, { 
      executedAt: new Date().toISOString(),
      messageSent: message,
    });

    console.log(`[SolutionProviderAgent] INFORM_CUSTOMER action ${action.actionId} completed, message: ${message.substring(0, 100)}...`);

    return {
      resolved: false,
      needsEscalation: false,
      suggestedResponse: message,
    };
  }

  private static getAllInputs(caseSolution: CaseSolutionWithDetails): Record<string, unknown> {
    return {
      ...(caseSolution.providedInputs as Record<string, unknown> || {}),
      ...(caseSolution.collectedInputsCustomer as Record<string, unknown> || {}),
      ...(caseSolution.collectedInputsSystems as Record<string, unknown> || {}),
    };
  }

  private static getMissingInputs(
    action: CaseActionWithDetails,
    allInputs: Record<string, unknown>
  ): Array<{ key: string; question: string; source: string }> {
    if (!action.action?.requiredInput) {
      return [];
    }

    const requiredKeys = action.action.requiredInput.split(",").map(k => k.trim());
    const missingInputs: Array<{ key: string; question: string; source: string }> = [];

    for (const key of requiredKeys) {
      if (allInputs[key] === undefined || allInputs[key] === null || allInputs[key] === "") {
        missingInputs.push({
          key,
          question: `Por favor, informe o ${key}`,
          source: "customer",
        });
      }
    }

    return missingInputs;
  }

  private static buildInputQuestion(
    missingInput: { key: string; question: string; source: string },
    action: CaseActionWithDetails
  ): string {
    return missingInput.question;
  }

  private static buildActionResponse(
    action: CaseActionWithDetails,
    inputs: Record<string, unknown>
  ): string {
    if (action.action?.messageTemplate) {
      let message = action.action.messageTemplate;
      for (const [key, value] of Object.entries(inputs)) {
        message = message.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
      }
      return message;
    }

    return `Estou processando sua solicitacao: ${action.action?.description || "Em andamento"}`;
  }
}
