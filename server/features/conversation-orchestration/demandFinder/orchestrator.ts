import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../ai/services/agentFramework.js";
import { caseDemandStorage } from "../../ai/storage/caseDemandStorage.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import { getClientRequestVersions, getSearchQueries, getCustomerRequestType, buildResolvedClassification, resolveProductById } from "../../ai/services/helpers/index.js";
import { EnrichmentService } from "../../ai/services/conversationOrchestrator/services/enrichmentService.js";
import { 
  ORCHESTRATOR_STATUS, 
  type DemandFinderAgentResult, 
  type OrchestratorContext,
  createAgentLogger,
  escalateConversation,
} from "../shared/index.js";
import { searchSolutionCenter, type SearchLogContext } from "../../../shared/services/solutionCenterClient.js";
import { withRetry } from "../../../../shared/utils/retry.js";
import { 
  handleSelectedIntent, 
  handleNeedClarification, 
  createEscalationResult,
  type DemandFinderPromptResult,
  type SearchResult,
  type DecisionHandlerResult 
} from "./handlers.js";

const CONFIG_KEY = "demand_finder";
const MAX_RETRIES = 3;
const log = createAgentLogger("DemandFinderOrchestrator");

export type DemandFinderProcessResult = DecisionHandlerResult;

export class DemandFinderOrchestrator {
  static async process(context: OrchestratorContext): Promise<DemandFinderProcessResult> {
    const { conversationId } = context;

    try {
      log.action(conversationId, "Starting demand finding");

      await caseDemandStorage.ensureActiveDemand(conversationId);

      const enrichmentResult = await EnrichmentService.enrich(context);
      
      if (!enrichmentResult.success) {
        log.warn(conversationId, `Enrichment failed: ${enrichmentResult.error}, escalating`);
        await this.handleEnrichmentFailure(conversationId, context, enrichmentResult.error);
        return createEscalationResult(enrichmentResult.error || "Enrichment failed");
      }

      const searchResult = await this.searchArticles(context);
      
      if (searchResult.failed) {
        log.warn(conversationId, "Solution Center API failed after 3 retries, escalating");
        await escalateConversation(conversationId, context, "Solution Center API failed after 3 retries", {
          sendApologyMessage: true,
          updateCaseDemandStatus: true,
          caseDemandStatus: "demand_not_found",
        });
        return createEscalationResult("Solution Center API failed after 3 retries");
      }
      
      context.searchResults = searchResult.results;

      const promptResult = await this.callDemandFinderPrompt(context);

      if (!promptResult) {
        log.warn(conversationId, "Prompt call failed, escalating");
        await escalateConversation(conversationId, context, "Prompt call failed", {
          sendApologyMessage: false,
          updateCaseDemandStatus: true,
          caseDemandStatus: "demand_not_found",
        });
        return createEscalationResult();
      }

      log.decision(conversationId, promptResult.decision, promptResult.reason);

      if (promptResult.decision === "selected_intent" && promptResult.selected_intent?.id) {
        return handleSelectedIntent(context, promptResult, searchResult.results || []);
      }

      return handleNeedClarification(context, promptResult, searchResult.results || []);

    } catch (error: any) {
      log.error(conversationId, "Error processing", error);
      await this.handleProcessError(conversationId, context);
      return createEscalationResult(error.message || "Failed to process demand finder");
    }
  }

  private static async handleEnrichmentFailure(
    conversationId: number,
    context: OrchestratorContext,
    error?: string
  ): Promise<void> {
    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });
    await caseDemandStorage.updateStatus(conversationId, "error");
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
  }

  private static async handleProcessError(
    conversationId: number,
    context: OrchestratorContext
  ): Promise<void> {
    try {
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      await caseDemandStorage.updateStatus(conversationId, "error");
      context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
    } catch (statusError) {
      console.error(`[DemandFinderOrchestrator] Failed to update status on error:`, statusError);
    }
  }

  private static async searchArticles(context: OrchestratorContext): Promise<{ results: SearchResult[]; failed: boolean }> {
    const { conversationId, summary } = context;

    const versions = getClientRequestVersions(summary);
    const searchQueries = getSearchQueries(summary);
    const customerRequestType = getCustomerRequestType(summary);
    
    log.action(conversationId, "Searching Solution Center");
    if (searchQueries) {
      log.info(conversationId, `Queries: verbatim=${!!searchQueries.verbatimQuery}, keyword=${!!searchQueries.keywordQuery}, normalized=${!!searchQueries.normalizedQuery}`);
    }
    if (customerRequestType) {
      log.info(conversationId, `Customer request type: ${customerRequestType}`);
    }

    const solutionCenterResult = await this.searchSolutionCenterExternal(context, searchQueries, versions, customerRequestType || undefined);

    if (solutionCenterResult.failed) {
      log.warn(conversationId, "Solution Center API failed after retries");
      return { results: [], failed: true };
    }

    if (!solutionCenterResult.results || solutionCenterResult.results.length === 0) {
      log.info(conversationId, "No results from Solution Center");
      return { results: [], failed: false };
    }

    const resultsForStorage: SearchResult[] = solutionCenterResult.results.map((r) => ({
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

  private static async callDemandFinderPrompt(context: OrchestratorContext): Promise<DemandFinderPromptResult | null> {
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
      console.log(`[DemandFinderOrchestrator] Agent call failed for conversation ${conversationId}: ${result.error}`);
      return null;
    }

    const parsed = result.parsedContent as Omit<DemandFinderPromptResult, 'suggestionId'> | undefined;
    if (!parsed || !parsed.decision) {
      console.log(`[DemandFinderOrchestrator] Invalid response format from agent for conversation ${conversationId}`);
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

      console.log(`[DemandFinderOrchestrator] generateResponseOnly completed for conversation ${conversationId}, decision: ${promptResult.decision}`);

      return {
        success: true,
        suggestedResponse: suggestedResponse || undefined,
      };
    } catch (error: any) {
      console.error(`[DemandFinderOrchestrator] Error in generateResponseOnly for conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate response",
      };
    }
  }
}

export { DemandFinderOrchestrator as DemandFinderAgent };
