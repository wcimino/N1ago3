import { storage } from "../../../../../storage/index.js";
import { runAgentAndSaveSuggestion, type AgentContext, type ContentPayload } from "../../agentFramework.js";
import type { DemandFinderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "demand_finder";

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { event, conversationId, summary, classification } = context;

    try {
      const last20Messages = await storage.getLast20MessagesForConversation(conversationId);
      const reversedMessages = [...last20Messages].reverse();

      const agentContext: AgentContext = {
        conversationId,
        externalConversationId: event.externalConversationId,
        lastEventId: event.id,
        summary,
        classification: classification ? {
          product: classification.product,
          subject: classification.subject,
          intent: classification.intent,
        } : null,
        messages: reversedMessages.map(m => ({
          authorType: m.authorType,
          authorName: m.authorName,
          contentText: m.contentText,
          occurredAt: m.occurredAt,
          eventSubtype: m.eventSubtype,
          contentPayload: m.contentPayload as ContentPayload | null,
        })),
        lastMessage: {
          authorType: event.authorType,
          authorName: event.authorName,
          contentText: event.contentText,
          occurredAt: event.occurredAt,
          eventSubtype: event.eventSubtype,
          contentPayload: event.contentPayload as ContentPayload | null,
        },
      };

      const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o",
        suggestionField: "suggestedAnswerToCustomer",
      });

      if (!result.success) {
        return {
          success: false,
          demandIdentified: false,
          error: result.error || "Failed to run demand finder",
        };
      }

      if (!result.responseContent) {
        console.log(`[DemandFinderAgent] No response for conversation ${conversationId}`);
        return {
          success: true,
          demandIdentified: false,
          needsMoreInfo: true,
        };
      }

      const parsedContent = result.parsedContent;

      let searchResults: DemandFinderAgentResult["searchResults"] = undefined;
      if (result.toolResult) {
        try {
          const toolData = result.toolResult;
          if (toolData.results && Array.isArray(toolData.results)) {
            searchResults = toolData.results.map((r: any) => ({
              source: r.source,
              id: r.id,
              name: r.name || "",
              description: r.description,
              matchScore: r.matchScore,
            }));
          }
        } catch (e: any) {
          console.error(`[DemandFinderAgent] Tool result parsing error:`, e);
        }
      }

      console.log(`[DemandFinderAgent] Processed conversation ${conversationId}, demandIdentified: ${parsedContent.demandIdentified}, suggestionId: ${result.suggestionId || 'none'}`);

      return {
        success: true,
        demandIdentified: parsedContent.demandIdentified ?? (!!parsedContent.demand),
        demand: parsedContent.demand,
        searchResults,
        needsMoreInfo: parsedContent.needsMoreInfo ?? false,
        followUpQuestion: parsedContent.followUpQuestion,
        suggestedAnswerToCustomer: parsedContent.suggestedAnswerToCustomer,
        suggestionId: result.suggestionId,
      };
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        demandIdentified: false,
        error: error.message || "Failed to find demand",
      };
    }
  }
}
