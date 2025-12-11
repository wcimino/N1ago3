import { eventStorage } from "../storage/eventStorage.js";
import { processSummaryForEvent } from "../../ai/services/summaryOrchestrator.js";
import { processClassificationForEvent } from "../../ai/services/classificationOrchestrator.js";
import { processResponseForEvent } from "../../ai/services/responseOrchestrator.js";
import { processLearningForEvent } from "../../ai/services/knowledgeLearningOrchestrator.js";
import { processHandoffEvent } from "../../handoff/index.js";
import { RoutingOrchestrator } from "../../routing/services/routingOrchestrator.js";
import type { EventStandard } from "../../../../shared/schema.js";

type StandardEventInput = Parameters<typeof eventStorage.saveStandardEvent>[0];

export async function dispatchEvent(event: EventStandard): Promise<void> {
  try {
    await RoutingOrchestrator.processRoutingForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process routing for event ${event.id}:`, error);
  }

  try {
    await RoutingOrchestrator.processOngoingRoutingForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process ongoing routing for event ${event.id}:`, error);
  }

  try {
    await processSummaryForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process summary for event ${event.id}:`, error);
  }

  try {
    await processClassificationForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process classification for event ${event.id}:`, error);
  }

  try {
    await processResponseForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process response for event ${event.id}:`, error);
  }

  try {
    await processLearningForEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process learning for event ${event.id}:`, error);
  }

  try {
    await processHandoffEvent(event);
  } catch (error) {
    console.error(`[EventDispatcher] Failed to process handoff for event ${event.id}:`, error);
  }
}

export async function saveAndDispatchEvent(eventData: StandardEventInput): Promise<{ event: EventStandard; isNew: boolean }> {
  const result = await eventStorage.saveStandardEvent(eventData);
  
  await dispatchEvent(result.event);
  
  return result;
}
