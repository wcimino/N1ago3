import { eventStorage } from "../storage/eventStorage.js";
import { processConversationEvent } from "../../conversation-orchestration/index.js";
import type { EventStandard } from "../../../../shared/schema.js";

type StandardEventInput = Parameters<typeof eventStorage.saveStandardEvent>[0];

export async function dispatchEvent(event: EventStandard): Promise<void> {
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
