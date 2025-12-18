import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { runCombinedKnowledgeSearch } from "../../tools/combinedKnowledgeSearchTool.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { getClientRequestVersions, buildCleanSearchContext, buildResolvedClassification } from "../../helpers/index.js";
import { EnrichmentService } from "../services/enrichmentService.js";
import { StatusController } from "../statusController.js";
import { ORCHESTRATOR_STATUS, type DemandFinderAgentResult, type OrchestratorContext } from "../types.js";

const CONFIG_KEY = "demand_finder";
const MAX_INTERACTIONS = 5;
const ARTICLE_SCORE_THRESHOLD = 80;

export interface DemandFinderProcessResult {
  success: boolean;
  demandConfirmed: boolean;
  needsClarification: boolean;
  maxInteractionsReached: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderProcessResult> {
    const { conversationId } = context;

    try {
      console.log(`[DemandFinderAgent] Starting demand finding for conversation ${conversationId}`);

      await caseDemandStorage.ensureActiveDemand(conversationId);

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
          suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
          error: enrichmentResult.error || "Enrichment failed",
        };
      }

      const searchResults = await this.searchArticles(context);
      context.searchResults = searchResults;

      const evaluation = await StatusController.evaluateDemandUnderstood(conversationId, context);

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
        };
      }

      console.log(`[DemandFinderAgent] Demand not confirmed - ${evaluation.reason}`);

      const clarificationResult = await this.generateClarificationQuestion(context);

      if (clarificationResult.suggestedResponse && clarificationResult.suggestionId) {
        const interactionCount = await caseDemandStorage.incrementInteractionCount(conversationId);
        console.log(`[DemandFinderAgent] Interaction ${interactionCount}/${MAX_INTERACTIONS} with clarification question`);

        if (interactionCount >= MAX_INTERACTIONS) {
          console.log(`[DemandFinderAgent] Max interactions reached, escalating`);
          
          await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
          await caseDemandStorage.updateStatus(conversationId, "demand_not_found");
          context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
          
          return {
            success: true,
            demandConfirmed: false,
            needsClarification: false,
            maxInteractionsReached: true,
            suggestedResponse: "Ok, vou te transferir para um especialista agora",
          };
        }

        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY);
        context.currentStatus = ORCHESTRATOR_STATUS.AWAITING_CUSTOMER_REPLY;
        
        return {
          success: true,
          demandConfirmed: false,
          needsClarification: true,
          maxInteractionsReached: false,
          suggestedResponse: clarificationResult.suggestedResponse,
          suggestionId: clarificationResult.suggestionId,
        };
      }

      console.log(`[DemandFinderAgent] No clarification question generated, escalating immediately`);
      
      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
      await caseDemandStorage.updateStatus(conversationId, "demand_not_found");
      context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
      
      return {
        success: true,
        demandConfirmed: false,
        needsClarification: false,
        maxInteractionsReached: true,
        suggestedResponse: "Vou te transferir para um especialista que podera te ajudar melhor.",
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
        suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
        error: error.message || "Failed to process demand finder",
      };
    }
  }

  private static async searchArticles(context: OrchestratorContext): Promise<DemandFinderAgentResult["searchResults"]> {
    const { conversationId, summary, classification } = context;

    const conversationContext = await buildCleanSearchContext(summary, classification);
    
    const versions = getClientRequestVersions(summary);
    const articleContext = versions?.clientRequestQuestionVersion;
    const problemContext = versions?.clientRequestProblemVersion;
    
    console.log(`[DemandFinderAgent] Searching articles for conversation ${conversationId}`);
    
    const searchResponse = await runCombinedKnowledgeSearch({
      productId: classification?.productId,
      conversationContext,
      articleContext,
      problemContext,
      limit: 10,
    });

    if (searchResponse.results.length === 0) {
      console.log(`[DemandFinderAgent] No articles found for conversation ${conversationId}`);
      return [];
    }

    const resultsForStorage = searchResponse.results.map(r => ({
      source: r.source,
      id: r.id,
      name: r.question || r.answer || "",
      description: r.answer || "",
      matchScore: r.matchScore,
      matchReason: r.matchReason,
      matchedTerms: r.matchedTerms,
      products: r.products,
    }));

    await caseDemandStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    console.log(`[DemandFinderAgent] Saved ${resultsForStorage.length} articles for conversation ${conversationId}`);

    return resultsForStorage;
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
