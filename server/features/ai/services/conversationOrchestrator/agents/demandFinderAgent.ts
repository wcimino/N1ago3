import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { getClientRequestVersions, getSearchQueries, getCustomerRequestType, buildResolvedClassification, resolveProductById } from "../../helpers/index.js";
import { EnrichmentService } from "../services/enrichmentService.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type DemandFinderAgentResult, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { searchSolutionCenter, type SearchLogContext } from "../../../../../shared/services/solutionCenterClient.js";
import { createAgentLogger, createEscalatedResult } from "../helpers/orchestratorHelpers.js";
import { withRetry } from "../../../../../../shared/utils/retry.js";

const CONFIG_KEY = "demand_finder";
const MAX_INTERACTIONS = 5;
const MAX_RETRIES = 3;
const log = createAgentLogger("DemandFinderAgent");

interface DemandFinderPromptResult {
  decision: "selected_intent" | "need_clarification";
  selected_intent: {
    id: string | null;
    label: string | null;
  };
  top_candidates_ranked: Array<{ id: string; label: string; why: string }>;
  clarifying_question: string | null;
  selected_intent_confidence?: number;
  reason: string;
}

export interface DemandFinderProcessResult {
  success: boolean;
  demandConfirmed: boolean;
  needsClarification: boolean;
  maxInteractionsReached: boolean;
  messageSent: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderProcessResult> {
    const { conversationId } = context;

    try {
      log.action(conversationId, "Starting demand finding");

      // Step 1: Ensure active demand exists
      await caseDemandStorage.ensureActiveDemand(conversationId);

      // Step 2: Enrichment (Summary + Classification)
      const enrichmentResult = await EnrichmentService.enrich(context);
      
      if (!enrichmentResult.success) {
        log.warn(conversationId, `Enrichment failed: ${enrichmentResult.error}, escalating`);
        
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        await caseDemandStorage.updateStatus(conversationId, "error");
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
          error: enrichmentResult.error || "Enrichment failed",
        };
      }

      // Step 3: Search articles/problems
      const searchResult = await this.searchArticles(context);
      
      if (searchResult.failed) {
        log.warn(conversationId, "Solution Center API failed after 3 retries, escalating");
        await this.escalateConversation(conversationId, context, "Solution Center API failed after 3 retries", { sendApologyMessage: true });
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
          error: "Solution Center API failed after 3 retries",
        };
      }
      
      context.searchResults = searchResult.results;

      // Step 4: Call AI to evaluate and decide (unified evaluation + question generation)
      const promptResult = await this.callDemandFinderPrompt(context);

      if (!promptResult) {
        log.warn(conversationId, "Prompt call failed, escalating");
        await this.escalateConversation(conversationId, context, "Prompt call failed");
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
        };
      }

      log.decision(conversationId, promptResult.decision, promptResult.reason);

      // Step 5: If AI selected an intent -> confirm demand and transition to solution provider
      if (promptResult.decision === "selected_intent" && promptResult.selected_intent?.id) {
        const selectedIntentId = promptResult.selected_intent.id;
        const candidateIds = searchResult.results?.map(r => r.id) || [];
        const isValidCandidate = candidateIds.includes(selectedIntentId);
        
        if (!isValidCandidate) {
          log.warn(conversationId, `AI selected intent "${selectedIntentId}" is NOT in candidate list: ${candidateIds.join(', ')}. Escalating`);
          
          await caseDemandStorage.updateDemandFinderAiResponse(conversationId, {
            decision: promptResult.decision,
            selected_intent: promptResult.selected_intent,
            top_candidates_ranked: promptResult.top_candidates_ranked || [],
            clarifying_question: promptResult.clarifying_question,
            selected_intent_confidence: promptResult.selected_intent_confidence,
            reason: promptResult.reason,
          });
          
          await this.escalateConversation(conversationId, context, `AI selected invalid intent: "${selectedIntentId}" not in candidates`, { sendApologyMessage: true });
          
          context.lastDispatchLog = {
            solutionCenterResults: searchResult.results?.length ?? 0,
            aiDecision: promptResult.decision,
            aiReason: promptResult.reason,
            action: "escalated_invalid_intent_selection",
            details: { 
              selectedIntentId,
              selectedIntentLabel: promptResult.selected_intent.label,
              validCandidateIds: candidateIds,
            },
          };
          
          return {
            success: true,
            demandConfirmed: false,
            needsClarification: false,
            maxInteractionsReached: true,
            messageSent: false,
            suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
            error: `AI selected invalid intent: "${selectedIntentId}" not in candidates`,
          };
        }
        
        log.action(conversationId, "Demand confirmed", `intent: ${promptResult.selected_intent.id} (${promptResult.selected_intent.label})`);
        
        await caseDemandStorage.updateSelectedIntent(conversationId, promptResult.selected_intent.id, {
          decision: promptResult.decision,
          selected_intent: promptResult.selected_intent,
          top_candidates_ranked: promptResult.top_candidates_ranked || [],
          clarifying_question: promptResult.clarifying_question,
          selected_intent_confidence: promptResult.selected_intent_confidence,
          reason: promptResult.reason,
        });
        
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
          conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
          waitingForCustomer: false,
        });
        await caseDemandStorage.updateStatus(conversationId, "demand_found");
        
        context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;
        context.demandFound = true;
        
        const selectedIntentUuid = promptResult.selected_intent.id;
        const selectedResult = searchResult.results?.find(r => r.id === promptResult.selected_intent.id);
        
        if (selectedResult?.source === "article") {
          context.articleUuid = selectedIntentUuid;
        } else if (selectedResult?.source === "problem") {
          context.problemId = selectedIntentUuid;
        }
        
        context.lastDispatchLog = {
          solutionCenterResults: searchResult.results?.length ?? 0,
          aiDecision: promptResult.decision,
          aiReason: promptResult.reason,
          action: "demand_confirmed_to_solution_provider",
          details: { 
            selectedIntentId: promptResult.selected_intent.id, 
            selectedIntentLabel: promptResult.selected_intent.label,
            intentType: selectedResult?.source || "unknown",
          },
        };
        
        return {
          success: true,
          demandConfirmed: true,
          needsClarification: false,
          maxInteractionsReached: false,
          messageSent: false,
        };
      }

      // Step 6: AI needs clarification - check interaction counter first
      const currentInteractionCount = await caseDemandStorage.getInteractionCount(conversationId);
      log.info(conversationId, `Interaction count: ${currentInteractionCount}/${MAX_INTERACTIONS}`);

      if (currentInteractionCount >= MAX_INTERACTIONS) {
        log.warn(conversationId, "Max interactions already reached, escalating");
        await this.escalateConversation(conversationId, context, "Max interactions reached", { sendApologyMessage: true });
        
        context.lastDispatchLog = {
          solutionCenterResults: searchResult.results?.length ?? 0,
          aiDecision: promptResult.decision,
          aiReason: promptResult.reason,
          action: "escalated_max_interactions",
          details: { interactionCount: currentInteractionCount, maxInteractions: MAX_INTERACTIONS },
        };
        
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Ok, vou te transferir para um especialista agora",
        };
      }

      // Step 7: Use clarifying_question from prompt result
      const clarifyingQuestion = promptResult.clarifying_question;
      const suggestionId = promptResult.suggestionId;

      // Save the AI response for debugging/auditing
      await caseDemandStorage.updateDemandFinderAiResponse(conversationId, {
        decision: promptResult.decision,
        selected_intent: promptResult.selected_intent,
        top_candidates_ranked: promptResult.top_candidates_ranked || [],
        clarifying_question: promptResult.clarifying_question,
        selected_intent_confidence: promptResult.selected_intent_confidence,
        reason: promptResult.reason,
      });
      
      if (!clarifyingQuestion || !suggestionId) {
        log.warn(conversationId, "No clarifying question or suggestionId from AI, escalating");
        await this.escalateConversation(conversationId, context, "No clarifying question generated");
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Vou te transferir para um especialista que podera te ajudar melhor.",
        };
      }

      // Step 8: Increment counter
      const newInteractionCount = await caseDemandStorage.incrementInteractionCount(conversationId);
      log.info(conversationId, `Incremented interaction count to ${newInteractionCount}/${MAX_INTERACTIONS}`);

      // Step 9: Send the message (ActionExecutor handles isN1agoHandler check)
      log.action(conversationId, "Sending clarification question");
      const action: OrchestratorAction = {
        type: "SEND_MESSAGE",
        payload: { suggestionId, responsePreview: clarifyingQuestion }
      };
      await ActionExecutor.execute(context, [action]);
      const messageSent = true;

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINDING_DEMAND,
        conversationOwner: CONVERSATION_OWNER.DEMAND_FINDER,
        waitingForCustomer: true,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
      
      context.lastDispatchLog = {
        solutionCenterResults: searchResult.results?.length ?? 0,
        aiDecision: promptResult.decision,
        aiReason: promptResult.reason,
        action: "sent_clarification",
        details: { interactionCount: newInteractionCount, maxInteractions: MAX_INTERACTIONS, suggestionId },
      };
      
      return {
        success: true,
        demandConfirmed: false,
        needsClarification: true,
        maxInteractionsReached: false,
        messageSent,
        suggestedResponse: clarifyingQuestion,
        suggestionId,
      };

    } catch (error: any) {
      log.error(conversationId, "Error processing", error);
      
      try {
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        await caseDemandStorage.updateStatus(conversationId, "error");
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
      } catch (statusError) {
        console.error(`[DemandFinderAgent] Failed to update status on error:`, statusError);
      }
      
      return {
        success: true,
        demandConfirmed: false,
        needsClarification: false,
        maxInteractionsReached: true,
        messageSent: false,
        suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
        error: error.message || "Failed to process demand finder",
      };
    }
  }

  private static async searchArticles(context: OrchestratorContext): Promise<{ results: DemandFinderAgentResult["searchResults"]; failed: boolean }> {
    const { conversationId, summary, classification } = context;

    const versions = getClientRequestVersions(summary);
    const searchQueries = getSearchQueries(summary);
    const customerRequestType = getCustomerRequestType(summary);
    
    log.action(conversationId, "Searching Solution Center");

    const solutionCenterResult = await this.searchSolutionCenterExternal(context, searchQueries, versions, customerRequestType || undefined);

    if (solutionCenterResult.failed) {
      log.warn(conversationId, "Solution Center API failed after retries");
      return { results: [], failed: true };
    }

    if (!solutionCenterResult.results || solutionCenterResult.results.length === 0) {
      log.info(conversationId, "No results from Solution Center");
      return { results: [], failed: false };
    }

    const resultsForStorage = solutionCenterResult.results.map((r) => ({
      source: r.type as "article" | "problem",
      id: r.id,
      name: r.name,
      description: "",
      matchScore: r.score,
    }));

    await caseDemandStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    log.info(conversationId, `Saved ${resultsForStorage.length} results to articlesAndProblems`);

    return { results: resultsForStorage, failed: false };
  }

  private static mapCustomerRequestTypeToDemandType(customerRequestType?: string): "information" | "sales" | "support" | undefined {
    if (!customerRequestType) return undefined;
    
    const normalized = customerRequestType.toLowerCase();
    
    if (normalized === "information" || normalized.includes("informaç") || normalized.includes("informac") || normalized.includes("quer informaç")) {
      return "information";
    }
    if (normalized === "sales" || normalized.includes("comprar") || normalized.includes("venda") || normalized.includes("contratar") || normalized.includes("quer contratar")) {
      return "sales";
    }
    if (normalized === "support" || normalized.includes("suporte") || normalized.includes("quer suporte")) {
      return "support";
    }
    
    return undefined;
  }

  private static async searchSolutionCenterExternal(
    context: OrchestratorContext,
    searchQueries: ReturnType<typeof getSearchQueries>,
    clientRequestVersions: ReturnType<typeof getClientRequestVersions>,
    customerRequestType?: string
  ): Promise<{ results: Array<{ type: "article" | "problem"; id: string; name: string; score: number }>; failed: boolean }> {
    const { conversationId, classification } = context;

    const textNormalizedVersions: string[] = [];
    
    if (searchQueries?.normalizedQuery) {
      textNormalizedVersions.push(searchQueries.normalizedQuery);
    }

    if (textNormalizedVersions.length === 0) {
      log.info(conversationId, "No text versions for Solution Center search, skipping");
      return { results: [], failed: false };
    }

    const text = clientRequestVersions?.clientRequestStandardVersion;
    const keywords = searchQueries?.keywordQuery?.split(/\s+/).filter(k => k.length > 2) || [];
    const demandType = this.mapCustomerRequestTypeToDemandType(customerRequestType);

    const resolvedProduct = await resolveProductById(classification?.productId);

    const textVerbatim = searchQueries?.verbatimQuery;

    const productConfidenceValue = context.classification?.productConfidence 
      ? context.classification.productConfidence / 100 
      : undefined;
    const demandTypeConfidenceValue = context.classification?.customerRequestTypeConfidence 
      ? context.classification.customerRequestTypeConfidence / 100 
      : undefined;

    const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
    const logContext: SearchLogContext = {
      caseDemandId: activeDemand?.id,
      conversationId,
    };

    try {
      const solutionCenterResponse = await withRetry(
        () => searchSolutionCenter(
          {
            text: text || undefined,
            textVerbatim: textVerbatim || undefined,
            textNormalizedVersions,
            keywords: keywords.length > 0 ? keywords : undefined,
            productName: resolvedProduct?.produto || undefined,
            subproductName: resolvedProduct?.subproduto || undefined,
            productConfidence: productConfidenceValue,
            subproductConfidence: productConfidenceValue,
            demandType,
            demandTypeConfidence: demandTypeConfidenceValue,
          },
          logContext
        ),
        {
          maxRetries: MAX_RETRIES,
          initialBackoffMs: 500,
          operationName: `SolutionCenter search (conversation ${conversationId})`,
        }
      );

      if (!solutionCenterResponse || !solutionCenterResponse.results || solutionCenterResponse.results.length === 0) {
        return { results: [], failed: false };
      }

      await caseDemandStorage.updateSolutionCenterResults(conversationId, solutionCenterResponse.results);
      log.info(conversationId, `Saved ${solutionCenterResponse.results.length} Solution Center results`);

      return { results: solutionCenterResponse.results, failed: false };

    } catch (error) {
      log.error(conversationId, `All ${MAX_RETRIES} Solution Center search attempts failed`, error);
      return { results: [], failed: true };
    }
  }

  private static async escalateConversation(
    conversationId: number,
    context: OrchestratorContext,
    reason: string,
    options?: { sendApologyMessage?: boolean }
  ): Promise<void> {
    const { escalateConversation: sharedEscalate } = await import("../helpers/orchestratorHelpers.js");
    await sharedEscalate(conversationId, context, reason, {
      sendApologyMessage: options?.sendApologyMessage ?? false,
      updateCaseDemandStatus: true,
      caseDemandStatus: "demand_not_found",
    });
  }

  private static async callDemandFinderPrompt(context: OrchestratorContext): Promise<(DemandFinderPromptResult & { suggestionId?: number }) | null> {
    const { event, conversationId, summary, classification, searchResults } = context;

    const resolvedClassification = await buildResolvedClassification(classification);

    const agentContext = await buildAgentContextFromEvent(event, {
      overrides: {
        summary,
        classification: resolvedClassification,
        searchResults,
      },
    });

    const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
      skipIfDisabled: true,
      defaultModelName: "gpt-4o-mini",
      suggestionField: "clarifying_question",
      inResponseTo: String(event.id),
    });

    if (!result.success) {
      console.log(`[DemandFinderAgent] Agent call failed for conversation ${conversationId}: ${result.error}`);
      return null;
    }

    const parsed = result.parsedContent as DemandFinderPromptResult | undefined;
    if (!parsed || !parsed.decision) {
      console.log(`[DemandFinderAgent] Invalid response format from agent for conversation ${conversationId}`);
      return null;
    }

    return {
      ...parsed,
      suggestionId: result.suggestionId,
    };
  }

  static async generateResponseOnly(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { conversationId } = context;

    try {
      const promptResult = await this.callDemandFinderPrompt(context);

      if (!promptResult) {
        return {
          success: false,
          error: "Failed to call demand finder prompt",
        };
      }

      const suggestedResponse = promptResult.decision === "need_clarification" 
        ? promptResult.clarifying_question 
        : undefined;

      console.log(`[DemandFinderAgent] generateResponseOnly completed for conversation ${conversationId}, decision: ${promptResult.decision}`);

      return {
        success: true,
        suggestedResponse: suggestedResponse || undefined,
      };
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error in generateResponseOnly for conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate response",
      };
    }
  }
}
