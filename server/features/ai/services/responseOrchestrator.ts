import { configStorage } from "../storage/configStorage.js";
import { eventStorage } from "../../events/storage/eventStorage.js";
import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "./agentFramework.js";
import { AutoPilotService } from "../../autoPilot/services/autoPilotService.js";
import type { EventStandard } from "../../../../shared/schema.js";

export async function shouldGenerateResponse(event: EventStandard): Promise<boolean> {
  const config = await configStorage.getOpenaiApiConfig("response");
  
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

  try {
    const context = await buildAgentContextFromEvent(event, {
      includeSummary: true,
      includeClassification: true,
    });

    console.log(`[Response Orchestrator] Generating response for conversation ${event.conversationId} with ${context.messages?.length || 0} messages`);

    const result = await runAgentAndSaveSuggestion("response", context, {
      maxIterations: 3,
      inResponseTo: String(event.id),
    });

    if (result.success && result.suggestionId) {
      await eventStorage.saveStandardEvent({
        eventType: "response_suggestion",
        source: "n1ago",
        conversationId: event.conversationId,
        externalConversationId: event.externalConversationId || undefined,
        authorType: "system",
        authorName: "N1 Ago",
        contentText: result.parsedContent?.suggestedAnswerToCustomer || result.responseContent || "",
        occurredAt: new Date(),
        metadata: {
          openaiLogId: result.logId,
          triggerEventId: event.id,
          suggestionId: result.suggestionId,
        },
      });

      console.log(`[Response Orchestrator] Response saved for conversation ${event.conversationId}, suggestionId: ${result.suggestionId}, logId: ${result.logId}`);

      const autoPilotResult = await AutoPilotService.processSuggestion(result.suggestionId);
      console.log(`[Response Orchestrator] AutoPilot result: action=${autoPilotResult.action}, reason=${autoPilotResult.reason}`);
    } else if (!result.success) {
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
