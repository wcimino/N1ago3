import { routingStorage } from "../storage/routingStorage.js";
import { ZendeskApiService } from "../../../services/zendeskApiService.js";
import { userStorage } from "../../conversations/storage/userStorage.js";
import type { EventStandard } from "../../../../shared/schema.js";

const processedConversations = new Set<string>();

export function shouldProcessRouting(event: EventStandard): boolean {
  if (event.eventType !== "conversation_started") {
    return false;
  }

  if (!event.externalConversationId) {
    return false;
  }

  if (processedConversations.has(event.externalConversationId)) {
    return false;
  }

  return true;
}

export async function processRoutingForEvent(event: EventStandard): Promise<void> {
  if (!shouldProcessRouting(event)) {
    return;
  }

  const externalConversationId = event.externalConversationId!;

  if (processedConversations.has(externalConversationId)) {
    console.log(`[RoutingOrchestrator] Conversation ${externalConversationId} already processed for routing`);
    return;
  }

  let userAuthenticated: boolean | undefined = undefined;
  if (event.externalUserId) {
    const user = await userStorage.getUserBySunshineId(event.externalUserId);
    if (user) {
      userAuthenticated = user.authenticated;
      console.log(`[RoutingOrchestrator] User ${event.externalUserId} authenticated: ${userAuthenticated}`);
    }
  }

  const activeRule = await routingStorage.getActiveAllocateNextNRule(userAuthenticated);
  
  if (!activeRule) {
    console.log("[RoutingOrchestrator] No active routing rules found");
    return;
  }

  console.log(`[RoutingOrchestrator] Found active rule: ${activeRule.id} - target: ${activeRule.target}`);

  const targetIntegrationId = getTargetIntegrationId(activeRule.target);
  
  if (!targetIntegrationId) {
    console.error(`[RoutingOrchestrator] Unknown target: ${activeRule.target}`);
    return;
  }

  const consumeResult = await routingStorage.tryConsumeRuleSlot(activeRule.id);
  
  if (!consumeResult.success) {
    console.log(`[RoutingOrchestrator] Rule ${activeRule.id} no longer has available slots`);
    return;
  }

  processedConversations.add(externalConversationId);

  try {
    console.log(`[RoutingOrchestrator] Requesting control for conversation ${externalConversationId} -> ${activeRule.target}`);
    
    const result = await ZendeskApiService.passControl(
      externalConversationId,
      targetIntegrationId,
      { source: "routing_rule", ruleId: activeRule.id },
      "routing",
      `rule:${activeRule.id}`
    );

    if (result.success) {
      console.log(`[RoutingOrchestrator] Successfully requested control for ${externalConversationId} (${consumeResult.rule?.allocatedCount}/${consumeResult.rule?.allocateCount})`);
      
      if (consumeResult.shouldDeactivate) {
        await routingStorage.deactivateRule(activeRule.id);
        console.log(`[RoutingOrchestrator] Rule ${activeRule.id} has been completed and deactivated`);
      }
    } else {
      console.error(`[RoutingOrchestrator] Failed to request control: ${result.error}`);
      processedConversations.delete(externalConversationId);
    }
  } catch (error) {
    console.error(`[RoutingOrchestrator] Error processing routing:`, error);
    processedConversations.delete(externalConversationId);
  }
}

function getTargetIntegrationId(target: string): string | null {
  switch (target.toLowerCase()) {
    case "n1ago":
      return ZendeskApiService.getN1agoIntegrationId();
    case "human":
      return ZendeskApiService.getAgentWorkspaceIntegrationId();
    case "bot":
      return ZendeskApiService.getAnswerBotIntegrationId();
    default:
      return null;
  }
}

export function clearProcessedConversations(): void {
  processedConversations.clear();
}

export const RoutingOrchestrator = {
  shouldProcessRouting,
  processRoutingForEvent,
  clearProcessedConversations,
};
