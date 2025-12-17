import { storage } from "../../../../storage/index.js";
import { conversationStorage } from "../../../conversations/storage/index.js";
import { SummaryAgent, ClassificationAgent, DemandFinderAgent, SolutionProviderAgent, ArticlesAndSolutionsAgent } from "./agents/index.js";
import { ORCHESTRATOR_STATUS, type OrchestratorStatus, type OrchestratorContext } from "./types.js";
import { StatusController } from "./statusController.js";
import { AutoPilotService } from "../../../autoPilot/services/autoPilotService.js";
import { ZendeskApiService } from "../../../external-sources/zendesk/services/zendeskApiService.js";
import type { EventStandard } from "../../../../../shared/schema.js";
import { summaryStorage } from "../../storage/summaryStorage.js";

type DemandFinderStatus = "not_started" | "in_progress" | "demand_found" | "demand_not_found" | "error";

const MAX_DEMAND_FINDER_INTERACTIONS = 5;

export class ConversationOrchestrator {
  static async processMessageEvent(event: EventStandard): Promise<void> {
    if (!event.conversationId) {
      console.log("[ConversationOrchestrator] No conversationId, skipping");
      return;
    }

    if (event.authorType !== "customer" && event.authorType !== "end_user") {
      console.log(`[ConversationOrchestrator] Skipping non-customer message (author: ${event.authorType})`);
      return;
    }

    const conversationId = event.conversationId;
    const currentStatus = await this.getConversationStatus(conversationId);

    console.log(`[ConversationOrchestrator] Processing event ${event.id} for conversation ${conversationId}, status: ${currentStatus}`);

    if (currentStatus === ORCHESTRATOR_STATUS.ESCALATED) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} is escalated, skipping`);
      return;
    }

    if (currentStatus === ORCHESTRATOR_STATUS.CLOSED) {
      console.log(`[ConversationOrchestrator] Conversation ${conversationId} is closed, skipping`);
      return;
    }

    const context: OrchestratorContext = {
      event,
      conversationId,
      currentStatus,
    };

    await this.processSyncPipeline(context);
  }

  private static async processSyncPipeline(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;

    console.log(`[ConversationOrchestrator] Starting sync pipeline for conversation ${conversationId}`);

    await this.step1_GenerateSummary(context);

    await this.step2_Classify(context);

    await this.step3_SearchArticlesAndProblems(context);

    await this.step4_DecideStatus(context);

    if (context.currentStatus === ORCHESTRATOR_STATUS.TEMP_DEMAND_UNDERSTOOD || 
        context.currentStatus === ORCHESTRATOR_STATUS.TEMP_DEMAND_NOT_UNDERSTOOD) {
      await this.step8_TransferToHuman(context);
      console.log(`[ConversationOrchestrator] Pipeline completed for conversation ${conversationId}, transferred to human`);
      return;
    }

    const demandResult = await this.step5_IdentifyDemand(context);

    const solutionResult = await this.step6_ProvideSolution(context);

    if (solutionResult.response && solutionResult.suggestionId) {
      await this.step7_SendResponse(context, solutionResult.response, solutionResult.suggestionId);
    } else if (demandResult.response && demandResult.suggestionId) {
      await this.step7_SendResponse(context, demandResult.response, demandResult.suggestionId);
    }

    console.log(`[ConversationOrchestrator] Pipeline completed for conversation ${conversationId}, final status: ${context.currentStatus}`);
  }

  private static async step1_GenerateSummary(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 1: Generating summary for conversation ${conversationId}`);

    const summaryResult = await SummaryAgent.process(context);
    
    if (summaryResult.success && summaryResult.summary) {
      context.summary = summaryResult.summary;
      console.log(`[ConversationOrchestrator] Step 1: Summary generated and saved`);
    } else {
      const existingSummary = await storage.getConversationSummary(conversationId);
      if (existingSummary) {
        context.summary = existingSummary.summary;
        context.classification = {
          productId: existingSummary.productId || undefined,
          customerRequestType: existingSummary.customerRequestType || undefined,
          productConfidence: existingSummary.productConfidence || undefined,
          customerRequestTypeConfidence: existingSummary.customerRequestTypeConfidence || undefined,
        };
        console.log(`[ConversationOrchestrator] Step 1: Using existing summary`);
      }
    }
  }

  private static async step2_Classify(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 2: Classifying conversation ${conversationId}`);

    const classificationResult = await ClassificationAgent.process(context);
    
    if (classificationResult.success) {
      context.classification = {
        productId: classificationResult.productId || context.classification?.productId,
        customerRequestType: classificationResult.customerRequestType || context.classification?.customerRequestType,
        productConfidence: classificationResult.productConfidence || context.classification?.productConfidence,
        customerRequestTypeConfidence: classificationResult.customerRequestTypeConfidence || context.classification?.customerRequestTypeConfidence,
      };
      console.log(`[ConversationOrchestrator] Step 2: Classification successful - productId: ${context.classification.productId}, requestType: ${context.classification.customerRequestType}, productConfidence: ${context.classification.productConfidence}, requestTypeConfidence: ${context.classification.customerRequestTypeConfidence}`);
    } else {
      console.log(`[ConversationOrchestrator] Step 2: Classification failed or skipped, keeping existing`);
    }
  }

  private static async step3_SearchArticlesAndProblems(context: OrchestratorContext): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 3: Searching articles and problems for conversation ${conversationId}`);

    const result = await ArticlesAndSolutionsAgent.process(context);

    if (result.success && result.searchResults && result.searchResults.length > 0) {
      context.searchResults = result.searchResults;
      console.log(`[ConversationOrchestrator] Step 3: Found ${result.searchResults.length} articles/problems (AI reranked)`);
    } else {
      console.log(`[ConversationOrchestrator] Step 3: No articles/problems found`);
    }
  }

  private static async step4_DecideStatus(context: OrchestratorContext): Promise<void> {
    const { conversationId, currentStatus } = context;
    console.log(`[ConversationOrchestrator] Step 4: Deciding status for conversation ${conversationId}, current: ${currentStatus}`);

    if (currentStatus === ORCHESTRATOR_STATUS.NEW) {
      await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING);
      context.currentStatus = ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING;
      await this.updateDemandFinderStatus(conversationId, "in_progress");
      console.log(`[ConversationOrchestrator] Step 4: Status updated to DEMAND_UNDERSTANDING, demand_finder_status: in_progress`);
    } else if (currentStatus === ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING) {
      const interactionCount = await conversationStorage.incrementDemandFinderInteractionCount(conversationId);
      console.log(`[ConversationOrchestrator] Step 4: Interaction count incremented to ${interactionCount}`);

      const evaluation = await StatusController.evaluateDemandUnderstood(conversationId);
      
      if (evaluation.canTransition) {
        await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.TEMP_DEMAND_UNDERSTOOD);
        context.currentStatus = ORCHESTRATOR_STATUS.TEMP_DEMAND_UNDERSTOOD;
        await this.updateDemandFinderStatus(conversationId, "demand_found");
        console.log(`[ConversationOrchestrator] Step 4: Status updated to TEMP_DEMAND_UNDERSTOOD, demand_finder_status: demand_found - ${evaluation.reason}`);
      } else if (interactionCount >= MAX_DEMAND_FINDER_INTERACTIONS) {
        await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.TEMP_DEMAND_NOT_UNDERSTOOD);
        context.currentStatus = ORCHESTRATOR_STATUS.TEMP_DEMAND_NOT_UNDERSTOOD;
        await this.updateDemandFinderStatus(conversationId, "demand_not_found");
        console.log(`[ConversationOrchestrator] Step 4: Status updated to TEMP_DEMAND_NOT_UNDERSTOOD, demand_finder_status: demand_not_found - max interactions reached (${interactionCount})`);
      } else {
        console.log(`[ConversationOrchestrator] Step 4: Status remains DEMAND_UNDERSTANDING - ${evaluation.reason} (interaction ${interactionCount}/${MAX_DEMAND_FINDER_INTERACTIONS})`);
      }
    } else {
      console.log(`[ConversationOrchestrator] Step 4: Status remains ${currentStatus}`);
    }
  }

  private static async updateDemandFinderStatus(conversationId: number, status: DemandFinderStatus): Promise<void> {
    try {
      await summaryStorage.updateDemandFinderStatus(conversationId, status);
      console.log(`[ConversationOrchestrator] Updated demand_finder_status to: ${status}`);
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error updating demand_finder_status:`, error);
    }
  }

  private static async step5_IdentifyDemand(context: OrchestratorContext): Promise<{ response: string | null; suggestionId?: number }> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 5: Running DemandFinder agent for conversation ${conversationId}`);

    try {
      const agentResult = await DemandFinderAgent.generateResponseOnly(context);

      if (!agentResult.success) {
        console.log(`[ConversationOrchestrator] Step 5: DemandFinder failed: ${agentResult.error}`);
        await this.updateDemandFinderStatus(conversationId, "error");
        return { response: null };
      }

      if (agentResult.rootCauseId) {
        context.rootCauseId = agentResult.rootCauseId;
        console.log(`[ConversationOrchestrator] Step 5: DemandFinder identified rootCauseId: ${agentResult.rootCauseId}`);
      }

      if (agentResult.providedInputs) {
        context.providedInputs = agentResult.providedInputs;
        console.log(`[ConversationOrchestrator] Step 5: DemandFinder collected inputs: ${JSON.stringify(agentResult.providedInputs)}`);
      }

      const response = agentResult.suggestedResponse || null;
      
      if (response) {
        console.log(`[ConversationOrchestrator] Step 5: DemandFinder generated response, suggestionId: ${agentResult.suggestionId}`);
      } else {
        console.log(`[ConversationOrchestrator] Step 5: DemandFinder completed without response`);
      }

      return { response, suggestionId: agentResult.suggestionId };
    } catch (error: any) {
      console.error(`[ConversationOrchestrator] Step 5: DemandFinder error:`, error);
      await this.updateDemandFinderStatus(conversationId, "error");
      return { response: null };
    }
  }

  private static async step6_ProvideSolution(context: OrchestratorContext): Promise<{ response: string | null; suggestionId?: number }> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Step 6: Running SolutionProvider for conversation ${conversationId}`);

    try {
      const result = await SolutionProviderAgent.process(context);

      if (!result.success) {
        console.log(`[ConversationOrchestrator] Step 6: SolutionProvider failed: ${result.error}`);
        return { response: null };
      }

      if (result.needsEscalation) {
        console.log(`[ConversationOrchestrator] Step 6: SolutionProvider needs escalation: ${result.escalationReason}`);
        return { response: null };
      }

      const response = result.suggestedResponse || null;

      if (response) {
        console.log(`[ConversationOrchestrator] Step 6: SolutionProvider generated response, suggestionId: ${result.suggestionId}`);
      } else {
        console.log(`[ConversationOrchestrator] Step 6: SolutionProvider completed without response`);
      }

      return { response, suggestionId: result.suggestionId };
    } catch (error: any) {
      console.error(`[ConversationOrchestrator] Step 6: SolutionProvider error:`, error);
      return { response: null };
    }
  }

  private static async step7_SendResponse(context: OrchestratorContext, response: string, suggestionId: number): Promise<void> {
    const { conversationId, currentStatus } = context;
    console.log(`[ConversationOrchestrator] Step 7: Sending response for conversation ${conversationId}`);
    console.log(`[ConversationOrchestrator] Step 7: Response: "${response.substring(0, 100)}..."`);
    
    if (currentStatus !== ORCHESTRATOR_STATUS.DEMAND_UNDERSTANDING) {
      console.log(`[ConversationOrchestrator] Step 7: Skipping send - status is ${currentStatus}, not demand_understanding`);
      return;
    }
    
    console.log(`[ConversationOrchestrator] Step 7: Processing suggestion ${suggestionId} via AutoPilot`);
    const result = await AutoPilotService.processSuggestion(suggestionId);
    console.log(`[ConversationOrchestrator] Step 7: AutoPilot result - action=${result.action}, reason=${result.reason}`);
  }

  private static async step8_TransferToHuman(context: OrchestratorContext): Promise<void> {
    const { conversationId, event } = context;
    console.log(`[ConversationOrchestrator] Step 8: Transferring conversation ${conversationId} to human agent`);

    const externalConversationId = event.externalConversationId;
    if (!externalConversationId) {
      console.error(`[ConversationOrchestrator] Step 8: Missing externalConversationId for conversation ${conversationId}`);
      return;
    }

    // Update status to ESCALATED FIRST to prevent duplicate messages from concurrent events
    await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
    console.log(`[ConversationOrchestrator] Step 7: Status updated to ESCALATED (before sending message)`);

    const transferMessage = "Ok, vou te transferir para um especialista agora";
    
    const messageResult = await ZendeskApiService.sendMessage(
      externalConversationId,
      transferMessage,
      "transfer",
      `transfer:${conversationId}`
    );

    if (messageResult.success) {
      console.log(`[ConversationOrchestrator] Step 7: Transfer message sent successfully`);
    } else {
      console.error(`[ConversationOrchestrator] Step 7: Failed to send transfer message: ${messageResult.error}`);
    }

    const agentWorkspaceId = ZendeskApiService.getAgentWorkspaceIntegrationId();
    const passControlResult = await ZendeskApiService.passControl(
      externalConversationId,
      agentWorkspaceId,
      { reason: "escalated" },
      "transfer",
      `transfer:${conversationId}`
    );

    if (passControlResult.success) {
      console.log(`[ConversationOrchestrator] Step 7: Control passed to agent workspace successfully`);
    } else {
      console.error(`[ConversationOrchestrator] Step 7: Failed to pass control: ${passControlResult.error}`);
    }
  }

  private static async escalate(context: OrchestratorContext, reason: string): Promise<void> {
    const { conversationId } = context;
    console.log(`[ConversationOrchestrator] Escalating conversation ${conversationId}: ${reason}`);

    await this.updateStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
  }

  static async getConversationStatus(conversationId: number): Promise<OrchestratorStatus> {
    try {
      const status = await conversationStorage.getOrchestratorStatus(conversationId);
      if (status) {
        return status as OrchestratorStatus;
      }
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error getting status for ${conversationId}:`, error);
    }
    return ORCHESTRATOR_STATUS.NEW;
  }

  static async updateStatus(conversationId: number, status: OrchestratorStatus): Promise<void> {
    try {
      await conversationStorage.updateOrchestratorStatus(conversationId, status);
      console.log(`[ConversationOrchestrator] Updated conversation ${conversationId} status to: ${status}`);
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error updating status for ${conversationId}:`, error);
    }
  }
}

export async function processConversationEvent(event: EventStandard): Promise<void> {
  await ConversationOrchestrator.processMessageEvent(event);
}
