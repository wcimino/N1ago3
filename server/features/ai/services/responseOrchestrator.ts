import { storage } from "../../../storage/index.js";
import { generateAndSaveResponse, type ResponsePayload } from "./responseAdapter.js";
import { generalSettingsStorage } from "../storage/generalSettingsStorage.js";
import type { EventStandard } from "../../../../shared/schema.js";
import type { ContentPayload } from "./promptUtils.js";

export async function shouldGenerateResponse(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("response");
  
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

export async function generateConversationResponse(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Response Orchestrator] Cannot generate response: no conversationId");
    return;
  }

  const config = await storage.getOpenaiApiConfig("response");
  if (!config) {
    console.log("[Response Orchestrator] Cannot generate response: no config found");
    return;
  }

  try {
    const existingSummary = await storage.getConversationSummary(event.conversationId);

    const last20Messages = await storage.getLast20MessagesForConversation(event.conversationId);

    const reversedMessages = [...last20Messages].reverse();

    const classification = (existingSummary?.product || existingSummary?.subproduct || existingSummary?.subject || existingSummary?.intent) ? {
      product: existingSummary.product,
      subproduct: existingSummary.subproduct,
      subject: existingSummary.subject,
      intent: existingSummary.intent,
      confidence: existingSummary.confidence,
    } : null;

    const payload: ResponsePayload = {
      currentSummary: existingSummary?.summary || null,
      classification,
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

    const useKnowledgeBaseTool = config.useKnowledgeBaseTool ?? false;
    const useProductCatalogTool = config.useProductCatalogTool ?? false;
    const useZendeskKnowledgeBaseTool = config.useZendeskKnowledgeBaseTool ?? false;

    let effectivePromptSystem = config.promptSystem;
    if (config.useGeneralSettings) {
      const generalSettings = await generalSettingsStorage.getConcatenatedContent();
      if (generalSettings) {
        effectivePromptSystem = generalSettings + "\n\n" + (config.promptSystem || "");
      }
    }

    console.log(`[Response Orchestrator] Generating response for conversation ${event.conversationId} with ${reversedMessages.length} messages, useKB=${useKnowledgeBaseTool}, useCatalog=${useProductCatalogTool}, useZendeskKB=${useZendeskKnowledgeBaseTool}, useGeneralSettings=${config.useGeneralSettings}`);

    const result = await generateAndSaveResponse(
      payload,
      effectivePromptSystem,
      config.responseFormat,
      config.modelName,
      event.conversationId,
      event.externalConversationId,
      event.id,
      useKnowledgeBaseTool,
      useProductCatalogTool,
      useZendeskKnowledgeBaseTool,
      String(event.id)
    );

    if (result.success) {
      console.log(`[Response Orchestrator] Response generated successfully for conversation ${event.conversationId}, usedKB=${result.usedKnowledgeBase}, articles=${result.articlesFound}, logId: ${result.logId}`);
    } else {
      console.error(`[Response Orchestrator] Failed to generate response: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[Response Orchestrator] Error generating response: ${error.message}`);
  }
}

export async function processResponseForEvent(event: EventStandard): Promise<void> {
  const shouldGenerate = await shouldGenerateResponse(event);
  
  if (shouldGenerate) {
    await generateConversationResponse(event);
  }
}
