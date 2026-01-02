import { getAdapter } from "../adapters/index.js";
import { webhookStorage } from "../../export/storage/webhookStorage.js";
import { userStorage } from "../../conversations/storage/userStorage.js";
import { usersStandardStorage } from "../../cadastro/storage/usersStandardStorage.js";
import { organizationsStandardStorage } from "../../cadastro/storage/organizationsStandardStorage.js";
import { conversationCore } from "../../conversations/storage/conversationCore.js";
import { eventBus, EVENTS } from "./eventBus.js";
import { saveAndDispatchEvent } from "./eventDispatcher.js";
import { enrichUserFromZendesk } from "../../external-sources/zendesk/services/zendeskUserEnrichmentService.js";
import { InboundConversationRouting } from "../../routing/services/inboundConversationRouting.js";

const SUPPORTED_SOURCES = ["zendesk"] as const;
type SupportedSource = typeof SUPPORTED_SOURCES[number];

export async function processRawEvent(rawId: number, source: string, skipStatusCheck = false): Promise<void> {
  const raw = await webhookStorage.getWebhookRawById(rawId, source);
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

  const routingResult = await InboundConversationRouting.tryRouteFromPayload(raw.payload, source);
  console.log(`[EventProcessor] Inbound routing: ${routingResult.routed ? `ROUTED to ${routingResult.target}` : routingResult.reason} (${routingResult.durationMs}ms)`);

  const adapter = getAdapter(source);
  if (!adapter) {
    await webhookStorage.updateWebhookRawStatus(rawId, source, "error", `No adapter for source: ${source}`);
    throw new Error(`No adapter for source: ${source}`);
  }

  if (!skipStatusCheck) {
    await webhookStorage.updateWebhookRawStatus(rawId, source, "processing");
  }

  try {
    const payload = raw.payload as any;

    const userData = adapter.extractUser(payload);
    let userId: number | undefined;
    if (userData) {
      const user = await userStorage.upsertUserByExternalId(userData);
      userId = user?.id;
      console.log(`User upsert - externalId: ${userData.externalId}, authenticated: ${userData.authenticated}`);
    }

    const standardUserData = adapter.extractStandardUser(payload);
    if (standardUserData) {
      try {
        await usersStandardStorage.upsertStandardUser(standardUserData);
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
      const result = await conversationCore.getOrCreateConversationByExternalId(convData);
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

    await webhookStorage.updateWebhookRawStatusWithEventsCount(rawId, source, "success", newEventsCount);
    await eventBus.emit(EVENTS.RAW_PROCESSED, { rawId, source, eventsCount: newEventsCount });

    console.log(`Processed raw event ${rawId}: ${newEventsCount} new events created (${standardEvents.length - newEventsCount} duplicates skipped)`);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    await webhookStorage.updateWebhookRawStatus(rawId, source, "error", errorMsg);
    await eventBus.emit(EVENTS.RAW_FAILED, { rawId, source, error: errorMsg });
    throw error;
  }
}

export async function processPendingRaws(): Promise<number> {
  let processedCount = 0;

  for (const source of SUPPORTED_SOURCES) {
    const stuckRaws = await webhookStorage.getStuckProcessingWebhookRaws(source, 5, 50);
    for (const raw of stuckRaws) {
      console.log(`Resetting stuck webhook ${raw.id} (was processing for too long)`);
      await webhookStorage.resetStuckWebhook(raw.id, source);
    }

    const pendingRaws = await webhookStorage.getPendingWebhookRaws(source);

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
