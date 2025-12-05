import { storage } from "../storage.js";
import { generateSummary, type SummaryPayload } from "./openaiSummaryService.js";
import type { EventStandard } from "../../shared/schema.js";

export async function shouldGenerateSummary(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiSummaryConfig();
  
  if (!config || !config.enabled) {
    return false;
  }

  if (!event.conversationId) {
    return false;
  }

  const triggerEventTypes = config.triggerEventTypes || [];
  
  const eventKey = `${event.source}:${event.eventType}`;
  const eventTypeOnly = event.eventType;
  
  return triggerEventTypes.includes(eventKey) || triggerEventTypes.includes(eventTypeOnly);
}

export async function generateConversationSummary(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("Cannot generate summary: no conversationId");
    return;
  }

  const config = await storage.getOpenaiSummaryConfig();
  if (!config) {
    console.log("Cannot generate summary: no config found");
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
      })),
      lastMessage: {
        authorType: event.authorType,
        authorName: event.authorName,
        contentText: event.contentText,
        occurredAt: event.occurredAt,
      }
    };

    console.log(`Generating summary for conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await generateSummary(payload, config.promptTemplate, config.modelName);

    if (result.success) {
      await storage.upsertConversationSummary({
        conversationId: event.conversationId,
        externalConversationId: event.externalConversationId || undefined,
        summary: result.summary,
        lastEventId: event.id,
      });

      console.log(`Summary generated and saved for conversation ${event.conversationId}`);
    } else {
      console.error(`Failed to generate summary for conversation ${event.conversationId}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`Error in generateConversationSummary for conversation ${event.conversationId}:`, error);
  }
}

export async function processSummaryForEvent(event: EventStandard): Promise<void> {
  const shouldGenerate = await shouldGenerateSummary(event);
  
  if (shouldGenerate) {
    await generateConversationSummary(event);
  }
}
