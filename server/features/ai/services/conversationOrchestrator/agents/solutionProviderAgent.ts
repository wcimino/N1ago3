import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { caseActionsStorage } from "../../../storage/caseActionsStorage.js";
import { SolutionResolverService } from "../../solutionResolverService.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, type SolutionProviderAgentResult, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import type { CaseSolutionWithDetails } from "../../../storage/caseSolutionStorage.js";
import type { CaseActionWithDetails } from "../../../storage/caseActionsStorage.js";
import { ACTION_TYPE_VALUES } from "../../../../../../shared/constants/actionTypes.js";

const CONFIG_KEY = "solution_provider";

export class SolutionProviderAgent {
  static async process(context: OrchestratorContext): Promise<SolutionProviderAgentResult> {
    const { event, conversationId, summary, classification, demand, searchResults, rootCauseId, providedInputs, demandFound, currentStatus } = context;

    try {
      console.log(`[SolutionProviderAgent] Processing conversation ${conversationId}`);
      console.log(`[SolutionProviderAgent] demandFound: ${demandFound}, rootCauseId: ${rootCauseId}, caseSolutionId: ${context.caseSolutionId}`);

      // Update status to PROVIDING_SOLUTION if coming from DEMAND_CONFIRMED
      if (currentStatus === ORCHESTRATOR_STATUS.DEMAND_CONFIRMED) {
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.PROVIDING_SOLUTION);
        context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;
        console.log(`[SolutionProviderAgent] Updated status to PROVIDING_SOLUTION`);
      }

      // If already awaiting solution inputs, check if we have new data before proceeding
      if (currentStatus === ORCHESTRATOR_STATUS.AWAITING_SOLUTION_INPUTS) {
        if (!providedInputs || Object.keys(providedInputs).length === 0) {
          // No new inputs from customer - stay in current status, dispatcher will stop
          console.log(`[SolutionProviderAgent] Already awaiting inputs, no new data provided - staying in AWAITING_SOLUTION_INPUTS`);
          return {
            success: true,
            resolved: false,
            needsEscalation: false,
          };
        }
        // New inputs received - move back to PROVIDING_SOLUTION to process
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.PROVIDING_SOLUTION);
        context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;
        console.log(`[SolutionProviderAgent] Received new inputs, moving from AWAITING_SOLUTION_INPUTS to PROVIDING_SOLUTION`);
      }

      let caseSolution = await caseSolutionStorage.getActiveByConversationId(conversationId);

      // Create case_solution if demand was found but no solution exists yet
      if (!caseSolution && (demandFound || rootCauseId)) {
        caseSolution = await this.createCaseSolutionFromDemand(context);
        if (caseSolution) {
          console.log(`[SolutionProviderAgent] Created case solution ${caseSolution.id}`);
          context.caseSolutionId = caseSolution.id;
        }
      }

      if (caseSolution) {
        if (providedInputs && Object.keys(providedInputs).length > 0) {
          await caseSolutionStorage.updateCollectedInputsCustomer(caseSolution.id, providedInputs);
          console.log(`[SolutionProviderAgent] Updated collected inputs for case solution ${caseSolution.id}`);
        }

        const caseSolutionWithDetails = await caseSolutionStorage.getByIdWithDetails(caseSolution.id);
        if (caseSolutionWithDetails) {
          const analysisResult = await this.analyzeAndProgress(caseSolutionWithDetails, context);
          
          // Handle escalation from analyzeAndProgress
          if (analysisResult.needsEscalation) {
            console.log(`[SolutionProviderAgent] Escalating from analyzeAndProgress`);
            await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
            context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
            return {
              success: true,
              ...analysisResult,
            };
          }

          // Send message if we have a suggestion (ActionExecutor handles isN1agoHandler check)
          if (analysisResult.suggestedResponse && analysisResult.suggestionId) {
            console.log(`[SolutionProviderAgent] Sending response from analyzeAndProgress for conversation ${conversationId}`);
            const action: OrchestratorAction = {
              type: "SEND_MESSAGE",
              payload: { suggestionId: analysisResult.suggestionId, responsePreview: analysisResult.suggestedResponse }
            };
            await ActionExecutor.execute(context, [action]);
          } else if (analysisResult.suggestedResponse && !analysisResult.suggestionId) {
            // Failed to save suggestion - escalate
            console.log(`[SolutionProviderAgent] Failed to save suggestion (no suggestionId), escalating`);
            await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
            context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
            return {
              success: true,
              resolved: false,
              needsEscalation: true,
            };
          }

          // Update status based on result
          if (analysisResult.resolved) {
            console.log(`[SolutionProviderAgent] Solution resolved from analyzeAndProgress, moving to FINALIZING`);
            await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINALIZING);
            context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
          } else if (analysisResult.suggestedResponse) {
            // We asked for more input - wait for customer reply
            console.log(`[SolutionProviderAgent] Awaiting customer input, moving to AWAITING_SOLUTION_INPUTS`);
            await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.AWAITING_SOLUTION_INPUTS);
            context.currentStatus = ORCHESTRATOR_STATUS.AWAITING_SOLUTION_INPUTS;
          }

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
        console.log(`[SolutionProviderAgent] Agent call failed for conversation ${conversationId}: ${result.error}, escalating`);
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: false,
          resolved: false,
          needsEscalation: true,
          error: result.error || "Failed to run solution provider",
        };
      }

      if (!result.responseContent) {
        console.log(`[SolutionProviderAgent] No response for conversation ${conversationId}, escalating`);
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: true,
          resolved: false,
          needsEscalation: true,
        };
      }

      const parsedContent = result.parsedContent;
      const resolved = parsedContent.resolved ?? true;
      const needsEscalation = parsedContent.needsEscalation ?? false;

      console.log(`[SolutionProviderAgent] Processed conversation ${conversationId}, resolved: ${resolved}, suggestionId: ${result.suggestionId || 'none'}`);

      // Handle escalation
      if (needsEscalation) {
        console.log(`[SolutionProviderAgent] Escalating conversation ${conversationId}: ${parsedContent.escalationReason}`);
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: true,
          resolved: false,
          needsEscalation: true,
          escalationReason: parsedContent.escalationReason,
        };
      }

      // Send message if we have a suggestion (ActionExecutor handles isN1agoHandler check)
      if (parsedContent.suggestedResponse && result.suggestionId) {
        console.log(`[SolutionProviderAgent] Sending response for conversation ${conversationId}`);
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: result.suggestionId, responsePreview: parsedContent.suggestedResponse }
        };
        await ActionExecutor.execute(context, [action]);
      } else if (parsedContent.suggestedResponse && !result.suggestionId) {
        // Failed to save suggestion - escalate
        console.log(`[SolutionProviderAgent] Failed to save suggestion (no suggestionId) from AI agent, escalating`);
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: true,
          resolved: false,
          needsEscalation: true,
        };
      }

      // Update status to FINALIZING if resolved
      if (resolved) {
        console.log(`[SolutionProviderAgent] Solution resolved, moving to FINALIZING`);
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINALIZING);
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
      }

      return {
        success: true,
        resolved,
        solution: parsedContent.solution,
        confidence: parsedContent.confidence,
        needsEscalation: false,
        suggestedResponse: parsedContent.suggestedResponse,
        suggestionId: result.suggestionId,
      };
    } catch (error: any) {
      console.error(`[SolutionProviderAgent] Error processing conversation ${conversationId}:`, error);
      
      try {
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        console.log(`[SolutionProviderAgent] Escalated conversation ${conversationId} due to error`);
      } catch (statusError) {
        console.error(`[SolutionProviderAgent] Failed to update status on error:`, statusError);
      }
      
      return {
        success: false,
        resolved: false,
        needsEscalation: true,
        error: error.message || "Failed to provide solution",
      };
    }
  }

  private static async createCaseSolutionFromDemand(context: OrchestratorContext): Promise<CaseSolutionWithDetails | null> {
    const { conversationId, rootCauseId, providedInputs } = context;

    try {
      // Use SolutionResolverService to resolve the best solution based on context
      const resolvedSolution = await SolutionResolverService.resolveSolutionForConversation(
        conversationId,
        rootCauseId
      );

      if (!resolvedSolution) {
        console.log(`[SolutionProviderAgent] No solution resolved for conversation ${conversationId}`);
        return null;
      }

      // Create case_solution with actions
      const caseSolution = await SolutionResolverService.createCaseSolutionWithActions(
        conversationId,
        resolvedSolution,
        providedInputs
      );

      console.log(`[SolutionProviderAgent] Created case_solution ${caseSolution.id} with solution type: ${resolvedSolution.solutionType}`);
      return caseSolution;
    } catch (error) {
      console.error(`[SolutionProviderAgent] Error creating case_solution:`, error);
      return null;
    }
  }

  private static async analyzeAndProgress(
    caseSolution: CaseSolutionWithDetails, 
    context: OrchestratorContext
  ): Promise<Omit<SolutionProviderAgentResult, "success">> {
    const { conversationId, event } = context;
    const nextAction = await caseActionsStorage.getNextPendingAction(caseSolution.id);

    if (!nextAction) {
      await caseSolutionStorage.updateStatus(caseSolution.id, "completed");
      console.log(`[SolutionProviderAgent] All actions completed for case solution ${caseSolution.id}`);
      const completionMessage = "Sua solicitacao foi processada com sucesso!";
      
      const savedSuggestion = await saveSuggestedResponse(conversationId, completionMessage, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });
      
      if (!savedSuggestion) {
        console.error(`[SolutionProviderAgent] Failed to save suggestion for conversation ${conversationId} (completion)`);
      } else {
        console.log(`[SolutionProviderAgent] Saved suggestion ${savedSuggestion.id} for conversation ${conversationId}`);
      }
      
      return {
        resolved: true,
        solution: caseSolution.solution?.name,
        needsEscalation: false,
        suggestedResponse: completionMessage,
        suggestionId: savedSuggestion?.id,
      };
    }

    const allInputs = this.getAllInputs(caseSolution);
    const actionType = nextAction.action?.actionType;

    if (actionType === ACTION_TYPE_VALUES.INFORM_CUSTOMER) {
      return await this.executeInformCustomerAction(caseSolution, nextAction, allInputs, context);
    }

    const missingInputs = this.getMissingInputs(nextAction, allInputs);

    if (missingInputs.length > 0) {
      await caseSolutionStorage.updateStatus(caseSolution.id, "pending_info");
      await caseSolutionStorage.updatePendingInputs(caseSolution.id, missingInputs);
      
      const question = this.buildInputQuestion(missingInputs[0], nextAction);
      console.log(`[SolutionProviderAgent] Missing inputs for action ${nextAction.actionId}: ${missingInputs.map(i => i.key).join(", ")}`);
      
      const savedSuggestion = await saveSuggestedResponse(conversationId, question, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });
      
      if (!savedSuggestion) {
        console.error(`[SolutionProviderAgent] Failed to save suggestion for conversation ${conversationId} (missing inputs), escalating`);
        return {
          resolved: false,
          needsEscalation: true,
          suggestedResponse: question,
        };
      }
      
      console.log(`[SolutionProviderAgent] Saved suggestion ${savedSuggestion.id} for conversation ${conversationId}`);
      
      return {
        resolved: false,
        needsEscalation: false,
        suggestedResponse: question,
        suggestionId: savedSuggestion.id,
      };
    }

    await caseSolutionStorage.updateStatus(caseSolution.id, "executing");
    await caseActionsStorage.startAction(nextAction.id, allInputs);
    
    console.log(`[SolutionProviderAgent] Executing action ${nextAction.actionId} for case solution ${caseSolution.id}`);

    const response = this.buildActionResponse(nextAction, allInputs);
    
    await caseActionsStorage.completeAction(nextAction.id, { executedAt: new Date().toISOString() });

    const savedSuggestion = await saveSuggestedResponse(conversationId, response, {
      lastEventId: event.id,
      externalConversationId: event.externalConversationId || null,
      inResponseTo: String(event.id),
    });

    if (!savedSuggestion) {
      console.error(`[SolutionProviderAgent] Failed to save suggestion for conversation ${conversationId} (action response)`);
    } else {
      console.log(`[SolutionProviderAgent] Saved suggestion ${savedSuggestion.id} for conversation ${conversationId}`);
    }

    return {
      resolved: false,
      needsEscalation: false,
      suggestedResponse: response,
      suggestionId: savedSuggestion?.id,
    };
  }

  private static escapeRegexKey(key: string): string {
    return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static async executeInformCustomerAction(
    caseSolution: CaseSolutionWithDetails,
    action: CaseActionWithDetails,
    allInputs: Record<string, unknown>,
    context: OrchestratorContext
  ): Promise<Omit<SolutionProviderAgentResult, "success">> {
    const { conversationId, event } = context;
    console.log(`[SolutionProviderAgent] Executing INFORM_CUSTOMER action ${action.actionId} for case solution ${caseSolution.id}`);

    await caseSolutionStorage.updateStatus(caseSolution.id, "executing");
    await caseActionsStorage.startAction(action.id, allInputs);

    const inputUsed = action.inputUsed as Record<string, unknown> | null;
    const messageTemplateFromInput = inputUsed?.messageTemplate as string | undefined;
    const messageTemplateFromAction = action.action?.messageTemplate;
    const messageTemplate = messageTemplateFromInput || messageTemplateFromAction;

    if (!messageTemplate) {
      await caseActionsStorage.failAction(action.id, "Message template not configured");
      await caseSolutionStorage.updateStatus(caseSolution.id, "error");
      console.log(`[SolutionProviderAgent] No message template for action ${action.actionId}`);
      return {
        resolved: false,
        needsEscalation: true,
      };
    }

    const templateSource = messageTemplateFromInput ? "inputUsed (article)" : "action";
    console.log(`[SolutionProviderAgent] Using messageTemplate from ${templateSource}`);

    let message = messageTemplate;
    for (const [key, value] of Object.entries(allInputs)) {
      const escapedKey = this.escapeRegexKey(key);
      message = message.replace(new RegExp(`\\{${escapedKey}\\}`, "g"), String(value));
    }

    await caseActionsStorage.completeAction(action.id, { 
      executedAt: new Date().toISOString(),
      messageSent: message,
      templateSource,
    });

    console.log(`[SolutionProviderAgent] INFORM_CUSTOMER action ${action.actionId} completed, message: ${message.substring(0, 100)}...`);

    const savedSuggestion = await saveSuggestedResponse(conversationId, message, {
      lastEventId: event.id,
      externalConversationId: event.externalConversationId || null,
      inResponseTo: String(event.id),
    });

    if (!savedSuggestion) {
      console.error(`[SolutionProviderAgent] Failed to save suggestion for conversation ${conversationId} (INFORM_CUSTOMER)`);
    } else {
      console.log(`[SolutionProviderAgent] Saved suggestion ${savedSuggestion.id} for conversation ${conversationId}`);
    }

    return {
      resolved: false,
      needsEscalation: false,
      suggestedResponse: message,
      suggestionId: savedSuggestion?.id,
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
