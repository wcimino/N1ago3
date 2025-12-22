import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { getClientRequestVersions, getSearchQueries, getCustomerRequestType, buildResolvedClassification, resolveProductById } from "../../helpers/index.js";
import { EnrichmentService } from "../services/enrichmentService.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type DemandFinderAgentResult, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { searchSolutionCenter } from "../../../../../shared/services/solutionCenterClient.js";

const CONFIG_KEY = "demand_finder";
const MAX_INTERACTIONS = 5;

interface DemandFinderPromptResult {
  decision: "selected_intent" | "need_clarification";
  selected_intent: {
    id: string | null;
    label: string | null;
  };
  top_candidates_ranked: Array<{ id: string; label: string; why: string }>;
  clarifying_question: string | null;
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
      console.log(`[DemandFinderAgent] Starting demand finding for conversation ${conversationId}`);

      // Step 1: Ensure active demand exists
      await caseDemandStorage.ensureActiveDemand(conversationId);

      // Step 2: Enrichment (Summary + Classification)
      const enrichmentResult = await EnrichmentService.enrich(context);
      
      if (!enrichmentResult.success) {
        console.log(`[DemandFinderAgent] Enrichment failed: ${enrichmentResult.error}, escalating`);
        
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
        console.log(`[DemandFinderAgent] Solution Center API failed after 3 retries, escalating`);
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
        console.log(`[DemandFinderAgent] Prompt call failed, escalating`);
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

      console.log(`[DemandFinderAgent] AI decision: ${promptResult.decision}, reason: ${promptResult.reason}`);

      // Step 5: If AI selected an intent -> confirm demand and transition to solution provider
      if (promptResult.decision === "selected_intent" && promptResult.selected_intent?.id) {
        console.log(`[DemandFinderAgent] Demand confirmed - selected intent: ${promptResult.selected_intent.id} (${promptResult.selected_intent.label})`);
        
        await caseDemandStorage.updateSelectedIntent(conversationId, promptResult.selected_intent.id, {
          decision: promptResult.decision,
          selected_intent: promptResult.selected_intent,
          top_candidates_ranked: promptResult.top_candidates_ranked || [],
          clarifying_question: promptResult.clarifying_question,
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
        
        const selectedIntentId = parseInt(promptResult.selected_intent.id, 10) || undefined;
        const selectedResult = searchResult.results?.find(r => r.id === promptResult.selected_intent.id);
        
        if (selectedResult?.source === "article") {
          context.articleId = selectedIntentId;
        } else {
          context.rootCauseId = selectedIntentId;
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
      console.log(`[DemandFinderAgent] Current interaction count: ${currentInteractionCount}/${MAX_INTERACTIONS}`);

      if (currentInteractionCount >= MAX_INTERACTIONS) {
        console.log(`[DemandFinderAgent] Max interactions already reached, escalating`);
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
        reason: promptResult.reason,
      });
      
      if (!clarifyingQuestion || !suggestionId) {
        console.log(`[DemandFinderAgent] No clarifying question or suggestionId from AI, escalating`);
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
      console.log(`[DemandFinderAgent] Incremented interaction count to ${newInteractionCount}/${MAX_INTERACTIONS}`);

      // Step 9: Send the message (ActionExecutor handles isN1agoHandler check)
      console.log(`[DemandFinderAgent] Sending clarification question for conversation ${conversationId}`);
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
      console.error(`[DemandFinderAgent] Error processing conversation ${conversationId}:`, error);
      
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
    
    console.log(`[DemandFinderAgent] Searching Solution Center for conversation ${conversationId}`);
    if (searchQueries) {
      console.log(`[DemandFinderAgent] Using queries: verbatim=${!!searchQueries.verbatimQuery}, keyword=${!!searchQueries.keywordQuery}, normalized=${!!searchQueries.normalizedQuery}`);
    }
    if (customerRequestType) {
      console.log(`[DemandFinderAgent] Customer request type: ${customerRequestType}`);
    }

    const solutionCenterResult = await this.searchSolutionCenterExternal(context, searchQueries, versions, customerRequestType || undefined);

    if (solutionCenterResult.failed) {
      console.log(`[DemandFinderAgent] Solution Center API failed after retries for conversation ${conversationId}`);
      return { results: [], failed: true };
    }

    if (!solutionCenterResult.results || solutionCenterResult.results.length === 0) {
      console.log(`[DemandFinderAgent] No results from Solution Center for conversation ${conversationId}`);
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
    console.log(`[DemandFinderAgent] Saved ${resultsForStorage.length} Solution Center results to articlesAndProblems for conversation ${conversationId}`);

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
    const MAX_RETRIES = 3;

    const textNormalizedVersions: string[] = [];
    
    if (searchQueries?.normalizedQuery) {
      textNormalizedVersions.push(searchQueries.normalizedQuery);
    }

    if (textNormalizedVersions.length === 0) {
      console.log(`[DemandFinderAgent] No text versions for Solution Center search, skipping`);
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

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[DemandFinderAgent] Solution Center search attempt ${attempt}/${MAX_RETRIES} for conversation ${conversationId}`);

        const solutionCenterResponse = await searchSolutionCenter({
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
        });

        if (!solutionCenterResponse || !solutionCenterResponse.results || solutionCenterResponse.results.length === 0) {
          return { results: [], failed: false };
        }

        await caseDemandStorage.updateSolutionCenterResults(conversationId, solutionCenterResponse.results);
        console.log(`[DemandFinderAgent] Saved ${solutionCenterResponse.results.length} Solution Center results for conversation ${conversationId}`);

        return { results: solutionCenterResponse.results, failed: false };

      } catch (error) {
        lastError = error;
        console.error(`[DemandFinderAgent] Solution Center search attempt ${attempt}/${MAX_RETRIES} failed for conversation ${conversationId}:`, error);
        
        if (attempt < MAX_RETRIES) {
          const delayMs = attempt * 500;
          console.log(`[DemandFinderAgent] Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`[DemandFinderAgent] All ${MAX_RETRIES} Solution Center search attempts failed for conversation ${conversationId}:`, lastError);
    return { results: [], failed: true };
  }

  private static async escalateConversation(
    conversationId: number,
    context: OrchestratorContext,
    reason: string,
    options?: { sendApologyMessage?: boolean }
  ): Promise<void> {
    console.log(`[DemandFinderAgent] Escalating conversation ${conversationId}: ${reason}`);
    
    const shouldSendApologyMessage = options?.sendApologyMessage ?? false;
    
    if (shouldSendApologyMessage) {
      const apologyMessage = "Desculpe, não consegui entender sua solicitação. Vou te transferir para um humano continuar o atendimento, aguarde um momento...";
      const transferAction: OrchestratorAction = {
        type: "TRANSFER_TO_HUMAN",
        payload: { reason, message: apologyMessage }
      };
      await ActionExecutor.execute(context, [transferAction]);
    }
    
    if (context.currentStatus !== ORCHESTRATOR_STATUS.ESCALATED) {
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
    }
    
    await caseDemandStorage.updateStatus(conversationId, "demand_not_found");
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
