import { storage } from "../storage.js";
import { classifyAndSave, type ClassificationPayload } from "./productClassificationAdapter.js";
import type { EventStandard } from "../../shared/schema.js";

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
    const last20Messages = await storage.getLast20MessagesForConversation(event.conversationId);

    const reversedMessages = [...last20Messages].reverse();

    const payload: ClassificationPayload = {
      last20Messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
      })),
    };

    console.log(`[Classification Orchestrator] Classifying conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await classifyAndSave(
      payload,
      config.promptTemplate,
      config.modelName,
      event.conversationId,
      event.externalConversationId
    );

    if (result.success) {
      console.log(`[Classification Orchestrator] Classification saved for conversation ${event.conversationId}: ${result.product}/${result.intent}`);
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
