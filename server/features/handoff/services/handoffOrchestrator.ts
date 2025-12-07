import { ZendeskApiService } from "../../../services/zendeskApiService.js";
import type { EventStandard } from "../../../../shared/schema.js";

interface HandoffContext {
  conversationId: string;
  previousIntegration?: string;
  metadata?: Record<string, unknown>;
}

export async function processHandoffEvent(event: EventStandard): Promise<void> {
  if (event.eventType !== "switchboard:passControl") {
    return;
  }

  const metadata = event.metadata as Record<string, unknown> | null;
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  const receivedIntegration = metadata?.switchboardIntegration as string | undefined;
  
  if (receivedIntegration !== n1agoIntegrationId) {
    console.log(`[HandoffOrchestrator] Ignoring passControl - not for n1ago (received: ${receivedIntegration}, expected: ${n1agoIntegrationId})`);
    return;
  }

  const conversationExternalId = event.externalConversationId;
  if (!conversationExternalId) {
    console.error("[HandoffOrchestrator] Missing externalConversationId in passControl event");
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
