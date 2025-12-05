import { getAdapter } from "../adapters/index.js";
import { storage } from "../storage.js";
import { eventBus, EVENTS } from "./eventBus.js";
import type { StandardEvent } from "../adapters/types.js";

export async function processRawEvent(rawId: number): Promise<void> {
  const raw = await storage.getWebhookRawById(rawId);
  if (!raw) {
    throw new Error(`Raw event not found: ${rawId}`);
  }

  if (raw.processingStatus === "success") {
    console.log(`Raw event ${rawId} already processed, skipping`);
    return;
  }

  const adapter = getAdapter(raw.source);
  if (!adapter) {
    await storage.updateWebhookRawStatus(rawId, "error", `No adapter for source: ${raw.source}`);
    throw new Error(`No adapter for source: ${raw.source}`);
  }

  try {
    const payload = raw.payload as any;

    const userData = adapter.extractUser(payload);
    let userId: number | undefined;
    if (userData) {
      const user = await storage.upsertUserByExternalId(userData);
      userId = user?.id;
      console.log(`User upsert - externalId: ${userData.externalId}, authenticated: ${userData.authenticated}`);
    }

    const convData = adapter.extractConversation(payload);
    let conversationId: number | undefined;
    if (convData) {
      const conversation = await storage.getOrCreateConversationByExternalId(convData);
      conversationId = conversation?.id;
    }

    const standardEvents = adapter.normalize(payload);

    for (const event of standardEvents) {
      await storage.saveStandardEvent({
        ...event,
        sourceRawId: rawId,
        conversationId,
        userId,
      });
    }

    await storage.updateWebhookRawStatus(rawId, "success");
    await eventBus.emit(EVENTS.RAW_PROCESSED, { rawId, eventsCount: standardEvents.length });

    console.log(`Processed raw event ${rawId}: ${standardEvents.length} events created`);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    await storage.updateWebhookRawStatus(rawId, "error", errorMsg);
    await eventBus.emit(EVENTS.RAW_FAILED, { rawId, error: errorMsg });
    throw error;
  }
}

export async function processPendingRaws(): Promise<number> {
  const pendingRaws = await storage.getPendingWebhookRaws();
  let processedCount = 0;

  for (const raw of pendingRaws) {
    try {
      await processRawEvent(raw.id);
      processedCount++;
    } catch (error) {
      console.error(`Failed to process raw ${raw.id}:`, error);
    }
  }

  return processedCount;
}

eventBus.on(EVENTS.RAW_CREATED, async ({ rawId }: { rawId: number }) => {
  try {
    await processRawEvent(rawId);
  } catch (error) {
    console.error(`Failed to process raw ${rawId} via event:`, error);
  }
});
