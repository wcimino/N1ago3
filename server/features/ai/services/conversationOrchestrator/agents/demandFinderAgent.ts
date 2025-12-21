import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { getClientRequestVersions, getSearchQueries, getCustomerRequestType, buildResolvedClassification, resolveProductById } from "../../helpers/index.js";
import { EnrichmentService } from "../services/enrichmentService.js";
import { StatusController } from "../statusController.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, type DemandFinderAgentResult, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { searchSolutionCenter } from "../../../../../shared/services/solutionCenterClient.js";

const CONFIG_KEY = "demand_finder";

function stableHashToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const MAX_INTERACTIONS = 5;
const ARTICLE_SCORE_THRESHOLD = 80;

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
        
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
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
      const searchResults = await this.searchArticles(context);
      context.searchResults = searchResults;

      // Step 4: Evaluate if demand is understood
      const evaluation = await StatusController.evaluateDemandUnderstood(conversationId, context);

      // Step 5: If understood -> confirm demand and exit
      if (evaluation.canTransition) {
        console.log(`[DemandFinderAgent] Demand confirmed - ${evaluation.reason}`);
        
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_CONFIRMED);
        await caseDemandStorage.updateStatus(conversationId, "demand_found");
        context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_CONFIRMED;
        
        return {
          success: true,
          demandConfirmed: true,
          needsClarification: false,
          maxInteractionsReached: false,
          messageSent: false,
        };
      }

      console.log(`[DemandFinderAgent] Demand not confirmed - ${evaluation.reason}`);

      // Step 6: Check interaction counter -> if limit reached, escalate and exit
      const currentInteractionCount = await caseDemandStorage.getInteractionCount(conversationId);
      console.log(`[DemandFinderAgent] Current interaction count: ${currentInteractionCount}/${MAX_INTERACTIONS}`);

      if (currentInteractionCount >= MAX_INTERACTIONS) {
        console.log(`[DemandFinderAgent] Max interactions already reached, escalating`);
        
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        await caseDemandStorage.updateStatus(conversationId, "demand_not_found");
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: false,
          maxInteractionsReached: true,
          messageSent: false,
          suggestedResponse: "Ok, vou te transferir para um especialista agora",
        };
      }

      // Step 7: Generate clarification question
      const clarificationResult = await this.generateClarificationQuestion(context);

      if (!clarificationResult.suggestedResponse || !clarificationResult.suggestionId) {
        console.log(`[DemandFinderAgent] No clarification question generated, escalating immediately`);
        
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        await caseDemandStorage.updateStatus(conversationId, "demand_not_found");
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        
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
        payload: { suggestionId: clarificationResult.suggestionId, responsePreview: clarificationResult.suggestedResponse }
      };
      await ActionExecutor.execute(context, [action]);
      const messageSent = true;

      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY);
      context.currentStatus = ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY;
      
      return {
        success: true,
        demandConfirmed: false,
        needsClarification: true,
        maxInteractionsReached: false,
        messageSent,
        suggestedResponse: clarificationResult.suggestedResponse,
        suggestionId: clarificationResult.suggestionId,
      };

    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error processing conversation ${conversationId}:`, error);
      
      try {
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
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

  private static async searchArticles(context: OrchestratorContext): Promise<DemandFinderAgentResult["searchResults"]> {
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

    const solutionCenterResults = await this.searchSolutionCenterExternal(context, searchQueries, versions, customerRequestType || undefined);

    if (!solutionCenterResults || solutionCenterResults.length === 0) {
      console.log(`[DemandFinderAgent] No results from Solution Center for conversation ${conversationId}`);
      return [];
    }

    const resultsForStorage = solutionCenterResults.map((r) => ({
      source: r.type as "article" | "problem",
      id: stableHashToNumber(`${r.type}_${r.id}`),
      name: r.name,
      description: `[Solution Center ID: ${r.id}]`,
      matchScore: r.score,
    }));

    await caseDemandStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    console.log(`[DemandFinderAgent] Saved ${resultsForStorage.length} Solution Center results to articlesAndProblems for conversation ${conversationId}`);

    return resultsForStorage;
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
  ): Promise<Array<{ type: "article" | "problem"; id: string; name: string; score: number }>> {
    const { conversationId, classification } = context;

    try {
      const textNormalizedVersions: string[] = [];
      
      if (searchQueries?.normalizedQuery) {
        textNormalizedVersions.push(searchQueries.normalizedQuery);
      }

      if (textNormalizedVersions.length === 0) {
        console.log(`[DemandFinderAgent] No text versions for Solution Center search, skipping`);
        return [];
      }

      const text = clientRequestVersions?.clientRequestStandardVersion;
      const keywords = searchQueries?.keywordQuery?.split(/\s+/).filter(k => k.length > 2) || [];
      const demandType = this.mapCustomerRequestTypeToDemandType(customerRequestType);

      const resolvedProduct = await resolveProductById(classification?.productId);

      const solutionCenterResponse = await searchSolutionCenter({
        text: text || undefined,
        textNormalizedVersions,
        keywords: keywords.length > 0 ? keywords : undefined,
        productName: resolvedProduct?.produto || undefined,
        subproductName: resolvedProduct?.subproduto || undefined,
        demandType,
      });

      if (!solutionCenterResponse || !solutionCenterResponse.results || solutionCenterResponse.results.length === 0) {
        return [];
      }

      await caseDemandStorage.updateSolutionCenterResults(conversationId, solutionCenterResponse.results);
      console.log(`[DemandFinderAgent] Saved ${solutionCenterResponse.results.length} Solution Center results for conversation ${conversationId}`);

      return solutionCenterResponse.results;

    } catch (error) {
      console.error(`[DemandFinderAgent] Error searching Solution Center for conversation ${conversationId}:`, error);
      return [];
    }
  }

  private static async generateClarificationQuestion(context: OrchestratorContext): Promise<{ suggestedResponse?: string; suggestionId?: number }> {
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
      suggestionField: "suggestedAnswerToCustomer",
      inResponseTo: String(event.id),
    });

    if (!result.success) {
      console.log(`[DemandFinderAgent] Agent call failed for conversation ${conversationId}: ${result.error}`);
      return {};
    }

    return {
      suggestedResponse: result.parsedContent?.suggestedAnswerToCustomer,
      suggestionId: result.suggestionId,
    };
  }

  static async generateResponseOnly(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { conversationId } = context;

    try {
      const agentResult = await this.generateClarificationQuestion(context);

      console.log(`[DemandFinderAgent] generateResponseOnly completed for conversation ${conversationId}, suggestionId: ${agentResult.suggestionId || 'none'}`);

      return {
        success: true,
        suggestedResponse: agentResult.suggestedResponse,
        suggestionId: agentResult.suggestionId,
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
