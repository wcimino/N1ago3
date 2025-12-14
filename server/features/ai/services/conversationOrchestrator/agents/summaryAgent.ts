import { shouldGenerateSummary } from "../../summaryOrchestrator.js";
import { generateAndSaveSummary, type SummaryPayload } from "../../summaryAdapter.js";
import { storage } from "../../../../../storage/index.js";
import { generalSettingsStorage } from "../../../storage/generalSettingsStorage.js";
import type { SummaryAgentResult, OrchestratorContext } from "../types.js";
import type { ContentPayload } from "../../promptUtils.js";

export class SummaryAgent {
  static async process(context: OrchestratorContext): Promise<SummaryAgentResult> {
    const { event, conversationId } = context;

    try {
      const shouldGenerate = await shouldGenerateSummary(event);
      
      if (!shouldGenerate) {
        console.log(`[SummaryAgent] Skipping summary generation for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      const config = await storage.getOpenaiApiConfig("summary");
      if (!config) {
        console.log("[SummaryAgent] Cannot generate summary: no config found");
        return { success: true, summary: undefined };
      }

      const existingSummary = await storage.getConversationSummary(conversationId);
      const last20Messages = await storage.getLast20MessagesForConversation(conversationId);
      const reversedMessages = [...last20Messages].reverse();

      const payload: SummaryPayload = {
        currentSummary: existingSummary?.summary || null,
        last20Messages: reversedMessages.map(m => ({
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
        }
      };

      let effectivePromptSystem = config.promptSystem;
      if (config.useGeneralSettings) {
        const generalSettings = await generalSettingsStorage.getConcatenatedContent();
        if (generalSettings) {
          effectivePromptSystem = generalSettings + "\n\n" + (config.promptSystem || "");
        }
      }

      const toolFlags = {
        useKnowledgeBaseTool: config.useKnowledgeBaseTool ?? false,
        useProductCatalogTool: config.useProductCatalogTool ?? false,
        useSubjectIntentTool: config.useSubjectIntentTool ?? false,
        useZendeskKnowledgeBaseTool: config.useZendeskKnowledgeBaseTool ?? false,
        useObjectiveProblemTool: config.useObjectiveProblemTool ?? false,
        useCombinedKnowledgeSearchTool: config.useCombinedKnowledgeSearchTool ?? false,
      };

      console.log(`[SummaryAgent] Generating and saving summary for conversation ${conversationId} with ${reversedMessages.length} messages`);

      const result = await generateAndSaveSummary(
        payload,
        effectivePromptSystem,
        config.responseFormat,
        config.modelName,
        conversationId,
        event.externalConversationId,
        event.id,
        toolFlags
      );

      if (!result.success) {
        console.error(`[SummaryAgent] Failed to generate summary: ${result.error}`);
        return {
          success: false,
          error: result.error || "Failed to generate summary",
        };
      }

      console.log(`[SummaryAgent] Summary generated and saved for conversation ${conversationId}`);

      return {
        success: true,
        summary: result.summary,
        structured: result.structured,
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
}
