import { configStorage } from "../../../../ai/storage/configStorage.js";
import { summaryStorage } from "../../../../ai/storage/summaryStorage.js";
import { runAgent, buildAgentContextFromEvent } from "../../agentFramework.js";
import { parseSummaryResponse, type ParsedSummary } from "../../summaryDomain/index.js";
import type { SummaryAgentResult, OrchestratorContext } from "../../../../conversation-orchestration/shared/types.js";

const CONFIG_KEY = "summary";

export class SummaryAgent {
  static async process(context: OrchestratorContext): Promise<SummaryAgentResult> {
    const { event, conversationId } = context;

    try {
      const shouldGenerate = await this.shouldGenerate(event);
      
      if (!shouldGenerate) {
        console.log(`[SummaryAgent] Skipping summary generation for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      console.log(`[SummaryAgent] Generating summary for conversation ${conversationId}`);

      const agentContext = await buildAgentContextFromEvent(event, {
        includeSummary: true,
        includeClassification: false,
      });

      const result = await runAgent(CONFIG_KEY, agentContext);

      if (!result.success) {
        console.error(`[SummaryAgent] Failed to generate summary for conversation ${conversationId}: ${result.error}`);
        return {
          success: false,
          error: result.error || "Failed to generate summary",
        };
      }

      if (!result.responseContent) {
        console.log(`[SummaryAgent] Empty response for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      const structured = parseSummaryResponse(result.responseContent);

      await summaryStorage.upsertConversationSummary({
        conversationId,
        externalConversationId: event.externalConversationId || undefined,
        summary: result.responseContent,
        clientRequest: structured?.clientRequest,
        clientRequestVersions: structured?.clientRequestVersions,
        agentActions: structured?.agentActions,
        currentStatus: structured?.currentStatus,
        importantInfo: structured?.importantInfo,
        customerEmotionLevel: structured?.customerEmotionLevel,
        objectiveProblems: structured?.objectiveProblems,
        lastEventId: event.id,
      });

      console.log(`[SummaryAgent] Summary generated for conversation ${conversationId}, logId: ${result.logId}`);

      return {
        success: true,
        summary: result.responseContent,
        structured: structured ? {
          clientRequest: structured.clientRequest,
          agentActions: structured.agentActions,
          currentStatus: structured.currentStatus,
          importantInfo: structured.importantInfo,
          customerEmotionLevel: structured.customerEmotionLevel,
          customerRequestType: undefined,
          objectiveProblems: structured.objectiveProblems,
        } : undefined,
        lastEventId: event.id,
        externalConversationId: event.externalConversationId,
      };
    } catch (error: any) {
      console.error(`[SummaryAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate summary",
      };
    }
  }

  private static async shouldGenerate(event: OrchestratorContext["event"]): Promise<boolean> {
    const config = await configStorage.getOpenaiApiConfig(CONFIG_KEY);
    
    if (!config || !config.enabled) {
      return false;
    }

    if (!event.conversationId) {
      return false;
    }

    const triggerEventTypes = config.triggerEventTypes || [];
    const triggerAuthorTypes = config.triggerAuthorTypes || [];
    
    let eventTypeMatches = true;
    if (triggerEventTypes.length > 0) {
      const eventKey = `${event.source}:${event.eventType}`;
      const eventTypeOnly = event.eventType;
      eventTypeMatches = triggerEventTypes.includes(eventKey) || triggerEventTypes.includes(eventTypeOnly);
    }
    
    if (!eventTypeMatches) {
      return false;
    }

    if (triggerAuthorTypes.length === 0) {
      return true;
    }

    return triggerAuthorTypes.includes(event.authorType);
  }
}
