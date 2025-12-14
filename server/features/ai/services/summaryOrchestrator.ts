import { storage } from "../../../storage/index.js";
import { generateAndSaveSummary, type SummaryPayload } from "./summaryAdapter.js";
import { generalSettingsStorage } from "../storage/generalSettingsStorage.js";
import type { EventStandard } from "../../../../shared/schema.js";
import type { ContentPayload } from "./promptUtils.js";

export async function shouldGenerateSummary(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("summary");
  
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

export async function generateConversationSummary(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Summary Orchestrator] Cannot generate summary: no conversationId");
    return;
  }

  const config = await storage.getOpenaiApiConfig("summary");
  if (!config) {
    console.log("[Summary Orchestrator] Cannot generate summary: no config found");
    return;
  }

  try {
    const existingSummary = await storage.getConversationSummary(event.conversationId);

    const last20Messages = await storage.getLast20MessagesForConversation(event.conversationId);

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

    let effectivePromptSystem = config.promptSystem || "";
    if (config.useGeneralSettings) {
      const generalSettings = await generalSettingsStorage.getConcatenatedContent();
      if (generalSettings) {
        effectivePromptSystem = generalSettings + "\n\n" + effectivePromptSystem;
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

    console.log(`[Summary Orchestrator] Generating summary for conversation ${event.conversationId} with ${reversedMessages.length} messages, useGeneralSettings=${config.useGeneralSettings}, useObjectiveProblemTool=${toolFlags.useObjectiveProblemTool}`);

    const result = await generateAndSaveSummary(
      payload,
      config.promptTemplate,
      effectivePromptSystem,
      config.responseFormat,
      config.modelName,
      event.conversationId,
      event.externalConversationId,
      event.id,
      toolFlags
    );

    if (result.success) {
      console.log(`[Summary Orchestrator] Summary generated and saved for conversation ${event.conversationId}`);
    } else {
      console.error(`[Summary Orchestrator] Failed to generate summary for conversation ${event.conversationId}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[Summary Orchestrator] Error in generateConversationSummary for conversation ${event.conversationId}:`, error);
  }
}

export async function processSummaryForEvent(event: EventStandard): Promise<void> {
  const shouldGenerate = await shouldGenerateSummary(event);
  
  if (shouldGenerate) {
    await generateConversationSummary(event);
  }
}
