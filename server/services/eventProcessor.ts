import { getAdapter } from "../adapters/index.js";
import { storage } from "../storage.js";
import { eventBus, EVENTS } from "./eventBus.js";
import type { StandardEvent } from "../adapters/types.js";

const SUPPORTED_SOURCES = ["zendesk"] as const;
type SupportedSource = typeof SUPPORTED_SOURCES[number];

export async function processRawEvent(rawId: number, source: string): Promise<void> {
  const raw = await storage.getWebhookRawById(rawId, source);
  if (!raw) {
    throw new Error(`Raw event not found: ${rawId} (source: ${source})`);
  }

  if (raw.processingStatus === "success") {
    console.log(`Raw event ${rawId} already processed, skipping`);
    return;
  }

  const adapter = getAdapter(source);
  if (!adapter) {
    await storage.updateWebhookRawStatus(rawId, source, "error", `No adapter for source: ${source}`);
    throw new Error(`No adapter for source: ${source}`);
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

    await storage.updateWebhookRawStatus(rawId, source, "success");
    await eventBus.emit(EVENTS.RAW_PROCESSED, { rawId, source, eventsCount: standardEvents.length });

    console.log(`Processed raw event ${rawId}: ${standardEvents.length} events created`);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    await storage.updateWebhookRawStatus(rawId, source, "error", errorMsg);
    await eventBus.emit(EVENTS.RAW_FAILED, { rawId, source, error: errorMsg });
    throw error;
  }
}

export async function processPendingRaws(): Promise<number> {
  let processedCount = 0;

  for (const source of SUPPORTED_SOURCES) {
    const pendingRaws = await storage.getPendingWebhookRaws(source);

    for (const raw of pendingRaws) {
      try {
        await processRawEvent(raw.id, source);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process raw ${raw.id} (source: ${source}):`, error);
      }
    }
  }

  return processedCount;
}

eventBus.on(EVENTS.RAW_CREATED, async ({ rawId, source }: { rawId: number; source: string }) => {
  try {
    await processRawEvent(rawId, source);
  } catch (error) {
    console.error(`Failed to process raw ${rawId} (source: ${source}) via event:`, error);
  }
});
