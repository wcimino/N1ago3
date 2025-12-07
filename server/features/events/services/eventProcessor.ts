import { getAdapter } from "../../../adapters/index.js";
import { storage } from "../../../storage/index.js";
import { organizationsStandardStorage } from "../../cadastro/storage/organizationsStandardStorage.js";
import { eventBus, EVENTS } from "./eventBus.js";
import { processSummaryForEvent } from "../../ai/services/summaryOrchestrator.js";
import { processClassificationForEvent } from "../../ai/services/classificationOrchestrator.js";
import { processResponseForEvent } from "../../ai/services/responseOrchestrator.js";
import { processHandoffEvent } from "../../handoff/index.js";
import type { StandardEvent } from "../../../adapters/types.js";

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
    if (convData) {
      const conversation = await storage.getOrCreateConversationByExternalId(convData);
      conversationId = conversation?.id;
    }

    const standardEvents = adapter.normalize(payload);

    for (const event of standardEvents) {
      const savedEvent = await storage.saveStandardEvent({
        ...event,
        sourceRawId: rawId,
        conversationId,
        userId,
      });
      
      try {
        await processSummaryForEvent(savedEvent);
      } catch (summaryError) {
        console.error(`Failed to process summary for event ${savedEvent.id}:`, summaryError);
      }

      try {
        await processClassificationForEvent(savedEvent);
      } catch (classificationError) {
        console.error(`Failed to process classification for event ${savedEvent.id}:`, classificationError);
      }

      try {
        await processResponseForEvent(savedEvent);
      } catch (responseError) {
        console.error(`Failed to process response for event ${savedEvent.id}:`, responseError);
      }

      try {
        await processHandoffEvent(savedEvent);
      } catch (handoffError) {
        console.error(`Failed to process handoff for event ${savedEvent.id}:`, handoffError);
      }

      if (event.eventType === "switchboard:passControl" && event.externalConversationId) {
        try {
          const metadata = event.metadata as Record<string, unknown> | null;
          let activeSwitchboard = metadata?.activeSwitchboardIntegration as Record<string, unknown> | undefined;
          
          if (!activeSwitchboard?.id) {
            const originalEvent = metadata?.originalEvent as Record<string, unknown> | undefined;
            const payload = originalEvent?.payload as Record<string, unknown> | undefined;
            const conversation = payload?.conversation as Record<string, unknown> | undefined;
            activeSwitchboard = conversation?.activeSwitchboardIntegration as Record<string, unknown> | undefined;
          }
          
          if (activeSwitchboard?.id && activeSwitchboard?.name) {
            await storage.updateConversationHandler(
              event.externalConversationId,
              activeSwitchboard.id as string,
              activeSwitchboard.name as string
            );
            console.log(`Updated conversation handler: ${event.externalConversationId} -> ${activeSwitchboard.name}`);
          }
        } catch (handlerError) {
          console.error(`Failed to update conversation handler for event ${savedEvent.id}:`, handlerError);
        }
      }
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
