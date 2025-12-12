import { storage } from "../../../storage/index.js";
import { classifyAndSave, type ClassificationPayload } from "./productClassificationAdapter.js";
import { generalSettingsStorage } from "../storage/generalSettingsStorage.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import type { EventStandard } from "../../../../shared/schema.js";
import type { ContentPayload } from "./promptUtils.js";

function formatProductCatalogAsJson(): Promise<string> {
  return productCatalogStorage.getAll().then(products => {
    const catalogList = products.map(p => ({
      produto: p.produto,
      subproduto: p.subproduto || null
    }));
    return JSON.stringify(catalogList, null, 2);
  });
}

export async function shouldClassify(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("classification");
  
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

export async function classifyConversationProduct(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Classification Orchestrator] Cannot classify: no conversationId");
    return;
  }

  const config = await storage.getOpenaiApiConfig("classification");
  if (!config) {
    console.log("[Classification Orchestrator] Cannot classify: no config found");
    return;
  }

  try {
    const [last20Messages, existingSummary, productCatalogJson] = await Promise.all([
      storage.getLast20MessagesForConversation(event.conversationId),
      storage.getConversationSummary(event.conversationId),
      formatProductCatalogAsJson()
    ]);

    const reversedMessages = [...last20Messages].reverse();

    const payload: ClassificationPayload = {
      last20Messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
        eventSubtype: m.eventSubtype,
        contentPayload: m.contentPayload as ContentPayload | null,
      })),
      currentSummary: existingSummary?.summary || null,
      productCatalogJson,
    };

    let effectivePromptSystem = config.promptSystem;
    if (config.useGeneralSettings) {
      const generalSettings = await generalSettingsStorage.getConcatenatedContent();
      if (generalSettings) {
        effectivePromptSystem = generalSettings + "\n\n" + (config.promptSystem || "");
      }
    }

    console.log(`[Classification Orchestrator] Classifying conversation ${event.conversationId} with ${reversedMessages.length} messages${existingSummary ? ' and existing summary' : ''}, useGeneralSettings=${config.useGeneralSettings}`);

    const result = await classifyAndSave(
      payload,
      effectivePromptSystem,
      config.responseFormat,
      config.modelName,
      event.conversationId,
      event.externalConversationId,
      config.useKnowledgeBaseTool ?? false,
      config.useProductCatalogTool ?? false,
      config.useSubjectIntentTool ?? false
    );

    if (result.success) {
      console.log(`[Classification Orchestrator] Classification saved for conversation ${event.conversationId}: ${result.product}/${result.subproduct}/${result.subject}/${result.intent}`);
    } else {
      console.error(`[Classification Orchestrator] Failed to classify conversation ${event.conversationId}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[Classification Orchestrator] Error in classifyConversationProduct for conversation ${event.conversationId}:`, error);
  }
}

export async function processClassificationForEvent(event: EventStandard): Promise<void> {
  const shouldRun = await shouldClassify(event);
  
  if (shouldRun) {
    await classifyConversationProduct(event);
  }
}
