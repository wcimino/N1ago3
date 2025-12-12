import { ZendeskApiService } from "../../../services/zendeskApiService.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import type { EventStandard } from "../../../../shared/schema.js";

interface HandoffContext {
  conversationId: string;
  previousIntegration?: string;
  metadata?: Record<string, unknown>;
}

function extractActiveSwitchboard(metadata: Record<string, unknown> | null): { id?: string; name?: string } {
  let activeSwitchboard = metadata?.activeSwitchboardIntegration as Record<string, unknown> | undefined;
  
  if (!activeSwitchboard?.id) {
    const originalEvent = metadata?.originalEvent as Record<string, unknown> | undefined;
    const payload = originalEvent?.payload as Record<string, unknown> | undefined;
    const conversation = payload?.conversation as Record<string, unknown> | undefined;
    activeSwitchboard = conversation?.activeSwitchboardIntegration as Record<string, unknown> | undefined;
  }
  
  return {
    id: activeSwitchboard?.id as string | undefined,
    name: activeSwitchboard?.name as string | undefined,
  };
}

export async function processHandoffEvent(event: EventStandard): Promise<void> {
  if (event.eventType !== "switchboard:passControl") {
    return;
  }

  const conversationExternalId = event.externalConversationId;
  if (!conversationExternalId) {
    console.error("[HandoffOrchestrator] Missing externalConversationId in passControl event");
    return;
  }

  const metadata = event.metadata as Record<string, unknown> | null;
  const activeSwitchboard = extractActiveSwitchboard(metadata);
  
  if (activeSwitchboard.id && activeSwitchboard.name) {
    try {
      await conversationStorage.updateConversationHandler(
        conversationExternalId,
        activeSwitchboard.id,
        activeSwitchboard.name
      );
      const isN1ago = activeSwitchboard.name?.toLowerCase().includes("n1ago");
      console.log(`[HandoffOrchestrator] Updated conversation handler: ${conversationExternalId} -> ${activeSwitchboard.name}${isN1ago ? ' (marked as handled by N1ago)' : ''}`);
    } catch (error) {
      console.error(`[HandoffOrchestrator] Failed to update conversation handler:`, error);
    }
  }

  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  
  if (activeSwitchboard.id !== n1agoIntegrationId) {
    return;
  }

  console.log(`[HandoffOrchestrator] n1ago received control for conversation ${conversationExternalId}`);

  const context: HandoffContext = {
    conversationId: conversationExternalId,
    previousIntegration: metadata?.previousIntegration as string | undefined,
    metadata: metadata?.switchboardMetadata as Record<string, unknown> | undefined,
  };

  await handleReceivedControl(context);
}

async function handleReceivedControl(context: HandoffContext): Promise<void> {
  console.log(`[HandoffOrchestrator] Handling received control for conversation ${context.conversationId}`);
  
  const acceptResult = await ZendeskApiService.acceptControl(
    context.conversationId,
    "handoff",
    `passControl:${context.conversationId}`
  );

  if (!acceptResult.success) {
    console.error(`[HandoffOrchestrator] Failed to accept control: ${acceptResult.error}`);
    return;
  }

  console.log(`[HandoffOrchestrator] Control accepted for conversation ${context.conversationId}`);

  const welcomeMessage = "Olá! Sou a assistente virtual da N1. Como posso ajudar você hoje?";
  
  const result = await ZendeskApiService.sendMessage(
    context.conversationId,
    welcomeMessage,
    "handoff",
    `passControl:${context.conversationId}`
  );

  if (result.success) {
    console.log(`[HandoffOrchestrator] Welcome message sent successfully to ${context.conversationId}`);
  } else {
    console.error(`[HandoffOrchestrator] Failed to send welcome message: ${result.error}`);
  }
}

export const HandoffOrchestrator = {
  processHandoffEvent,
};
