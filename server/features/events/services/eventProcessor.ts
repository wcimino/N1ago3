import { getAdapter } from "../adapters/index.js";
import { storage } from "../../../storage/index.js";
import { organizationsStandardStorage } from "../../cadastro/storage/organizationsStandardStorage.js";
import { eventBus, EVENTS } from "./eventBus.js";
import { saveAndDispatchEvent } from "./eventDispatcher.js";
import { enrichUserFromZendesk } from "../../external-sources/zendesk/services/zendeskUserEnrichmentService.js";

const SUPPORTED_SOURCES = ["zendesk"] as const;
type SupportedSource = typeof SUPPORTED_SOURCES[number];

export async function processRawEvent(rawId: number, source: string, skipStatusCheck = false): Promise<void> {
  const raw = await storage.getWebhookRawById(rawId, source);
  if (!raw) {
    throw new Error(`Raw event not found: ${rawId} (source: ${source})`);
  }

  if (raw.processingStatus === "success") {
    console.log(`Raw event ${rawId} already processed, skipping`);
    return;
  }

  if (!skipStatusCheck && raw.processingStatus === "processing") {
    console.log(`Raw event ${rawId} already being processed, skipping`);
    return;
  }

  const eventsCreatedCount = (raw as any).eventsCreatedCount || 0;
  if (eventsCreatedCount > 0) {
    console.log(`Raw event ${rawId} already created ${eventsCreatedCount} events, marking as success`);
    await storage.updateWebhookRawStatusWithEventsCount(rawId, source, "success", eventsCreatedCount);
    return;
  }

  const adapter = getAdapter(source);
  if (!adapter) {
    await storage.updateWebhookRawStatus(rawId, source, "error", `No adapter for source: ${source}`);
    throw new Error(`No adapter for source: ${source}`);
  }

  if (!skipStatusCheck) {
    await storage.updateWebhookRawStatus(rawId, source, "processing");
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

    const standardUserData = adapter.extractStandardUser(payload);
    if (standardUserData) {
      try {
        await storage.upsertStandardUser(standardUserData);
        console.log(`Standard user upsert - email: ${standardUserData.email}`);
      } catch (error) {
        console.error(`Failed to upsert standard user ${standardUserData.email}:`, error);
      }
    }

    const standardOrgData = adapter.extractStandardOrganization(payload);
    if (standardOrgData) {
      try {
        await organizationsStandardStorage.upsertStandardOrganization(standardOrgData);
        console.log(`Standard organization upsert - cnpjRoot: ${standardOrgData.cnpjRoot}`);

        if (standardUserData?.email) {
          await organizationsStandardStorage.linkUserToOrganization(standardUserData.email, standardOrgData.cnpjRoot);
          console.log(`User-Organization link created - email: ${standardUserData.email}, cnpjRoot: ${standardOrgData.cnpjRoot}`);
        }
      } catch (error) {
        console.error(`Failed to upsert standard organization ${standardOrgData.cnpjRoot}:`, error);
      }
    }

    const convData = adapter.extractConversation(payload);
    let conversationId: number | undefined;
    let isNewConversation = false;
    if (convData) {
      const result = await storage.getOrCreateConversationByExternalId(convData);
      conversationId = result?.conversation?.id;
      isNewConversation = result?.isNew ?? false;
      
      if (isNewConversation) {
        console.log(`[EventProcessor] New conversation created: ${conversationId}, externalId: ${convData.externalConversationId}`);
      }
    }

    if (isNewConversation && standardUserData?.email) {
      console.log(`[EventProcessor] Triggering Zendesk enrichment for email: ${standardUserData.email}`);
      enrichUserFromZendesk(standardUserData.email).catch(err =>
        console.error(`[EventProcessor] Failed to enrich user ${standardUserData.email}:`, err)
      );
    }

    const standardEvents = adapter.normalize(payload);

    let newEventsCount = 0;
    for (const event of standardEvents) {
      const { event: savedEvent, isNew } = await saveAndDispatchEvent({
        ...event,
        sourceRawId: rawId,
        conversationId,
        userId,
      });

      if (isNew) {
        newEventsCount++;
      }
    }

    await storage.updateWebhookRawStatusWithEventsCount(rawId, source, "success", newEventsCount);
    await eventBus.emit(EVENTS.RAW_PROCESSED, { rawId, source, eventsCount: newEventsCount });

    console.log(`Processed raw event ${rawId}: ${newEventsCount} new events created (${standardEvents.length - newEventsCount} duplicates skipped)`);
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
    const stuckRaws = await storage.getStuckProcessingWebhookRaws(source, 5, 50);
    for (const raw of stuckRaws) {
      console.log(`Resetting stuck webhook ${raw.id} (was processing for too long)`);
      await storage.resetStuckWebhook(raw.id, source);
    }

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

eventBus.on(EVENTS.RAW_CREATED, async ({ rawId, source, skipStatusCheck }: { rawId: number; source: string; skipStatusCheck?: boolean }) => {
  try {
    await processRawEvent(rawId, source, skipStatusCheck);
  } catch (error) {
    console.error(`Failed to process raw ${rawId} (source: ${source}) via event:`, error);
  }
});
