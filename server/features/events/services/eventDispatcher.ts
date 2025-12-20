import { eventStorage } from "../storage/eventStorage.js";
import { RoutingOrchestrator } from "../../routing/services/routingOrchestrator.js";
import { processConversationEvent } from "../../ai/services/conversationOrchestrator/index.js";
import { processHandoffEvent } from "../../handoff/index.js";
import type { EventStandard } from "../../../../shared/schema.js";

type StandardEventInput = Parameters<typeof eventStorage.saveStandardEvent>[0];

export async function dispatchEvent(event: EventStandard): Promise<void> {
  try {
    await RoutingOrchestrator.processRoutingEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process routing for event ${event.id}:`, error);
  }

  try {
    await processHandoffEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process handoff for event ${event.id}:`, error);
  }

  if (event.eventType === "message") {
    try {
      await processConversationEvent(event);
    } catch (error) {
      console.error(`[EventDispatcher] Failed to process conversation orchestrator for event ${event.id}:`, error);
    }
  }
}

export async function saveAndDispatchEvent(eventData: StandardEventInput): Promise<{ event: EventStandard; isNew: boolean }> {
  const result = await eventStorage.saveStandardEvent(eventData);
  
  if (result.isNew) {
    await dispatchEvent(result.event);
  } else {
    console.log(`[EventDispatcher] Skipping dispatch for duplicate event ${result.event.id} (sourceEventId: ${result.event.sourceEventId})`);
  }
  
  return result;
}
