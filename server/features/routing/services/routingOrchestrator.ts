import { routingStorage } from "../storage/routingStorage.js";
import { ZendeskApiService } from "../../../services/zendeskApiService.js";
import { userStorage } from "../../conversations/storage/userStorage.js";
import type { EventStandard, RoutingRule } from "../../../../shared/schema.js";

const processedAllocateNextN = new Set<string>();
const processedTransferOngoing = new Set<string>();

function shouldProcessRouting(event: EventStandard): boolean {
  if (event.eventType !== "conversation_started" && event.eventType !== "message") {
    return false;
  }

  if (!event.externalConversationId) {
    return false;
  }

  return true;
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

function evaluateRule(rule: RoutingRule, event: EventStandard, userAuthenticated: boolean | undefined): { matches: boolean; reason: string } {
  if (rule.ruleType === "allocate_next_n") {
    if (event.eventType !== "conversation_started") {
      return { matches: false, reason: "not conversation_started event" };
    }
    
    if (processedAllocateNextN.has(event.externalConversationId!)) {
      return { matches: false, reason: "conversation already processed for allocate_next_n" };
    }
    
    if (!routingStorage.matchesAuthFilter(rule, userAuthenticated)) {
      return { matches: false, reason: `auth filter mismatch (filter=${rule.authFilter}, user=${userAuthenticated})` };
    }
    
    return { matches: true, reason: "allocate_next_n conditions met" };
  }
  
  if (rule.ruleType === "transfer_ongoing") {
    if (event.eventType !== "message") {
      return { matches: false, reason: "not message event" };
    }
    
    if (event.authorType !== "user" && event.authorType !== "customer" && event.authorType !== "bot") {
      return { matches: false, reason: `invalid author type: ${event.authorType}` };
    }
    
    if (!event.contentText || event.contentText.trim() === "") {
      return { matches: false, reason: "no message text" };
    }
    
    if (processedTransferOngoing.has(event.externalConversationId!)) {
      return { matches: false, reason: "conversation already routed via transfer_ongoing" };
    }
    
    if (!routingStorage.matchesText(rule.matchText, event.contentText)) {
      return { matches: false, reason: `text mismatch (rule="${rule.matchText?.substring(0, 30)}...", msg="${event.contentText.substring(0, 30)}...")` };
    }
    
    return { matches: true, reason: `text match: "${rule.matchText}"` };
  }
  
  return { matches: false, reason: `unknown rule type: ${rule.ruleType}` };
}

export async function processRoutingEvent(event: EventStandard): Promise<void> {
  if (!shouldProcessRouting(event)) {
    return;
  }

  const externalConversationId = event.externalConversationId!;
  const messagePreview = event.contentText ? event.contentText.substring(0, 50) : "(no text)";
  
  console.log(`[Routing] Event received: type=${event.eventType}, conversation=${externalConversationId}, author=${event.authorType}, text="${messagePreview}..."`);

  let userAuthenticated: boolean | undefined = undefined;
  if (event.externalUserId) {
    const user = await userStorage.getUserBySunshineId(event.externalUserId);
    if (user) {
      userAuthenticated = user.authenticated;
    }
  }

  const activeRules = await routingStorage.getAllActiveRules();
  
  if (activeRules.length === 0) {
    console.log(`[Routing] No active rules found`);
    return;
  }
  
  console.log(`[Routing] Found ${activeRules.length} active rule(s), evaluating...`);

  for (const rule of activeRules) {
    const { matches, reason } = evaluateRule(rule, event, userAuthenticated);
    
    console.log(`[Routing] Rule ${rule.id} (${rule.ruleType}): ${matches ? "MATCH" : "no match"} - ${reason}`);
    
    if (!matches) {
      continue;
    }

    const targetIntegrationId = getTargetIntegrationId(rule.target);
    
    if (!targetIntegrationId) {
      console.error(`[Routing] Rule ${rule.id}: Unknown target "${rule.target}"`);
      continue;
    }

    const consumeResult = await routingStorage.tryConsumeRuleSlot(rule.id);
    
    if (!consumeResult.success) {
      console.log(`[Routing] Rule ${rule.id}: No available slots`);
      continue;
    }
    
    console.log(`[Routing] Rule ${rule.id}: Slot consumed (${consumeResult.rule?.allocatedCount}/${consumeResult.rule?.allocateCount})`);

    const trackingSet = rule.ruleType === "allocate_next_n" ? processedAllocateNextN : processedTransferOngoing;
    trackingSet.add(externalConversationId);

    try {
      console.log(`[Routing] Rule ${rule.id}: Calling passControl -> ${rule.target}`);
      
      const result = await ZendeskApiService.passControl(
        externalConversationId,
        targetIntegrationId,
        { source: "routing_rule", ruleId: rule.id, ruleType: rule.ruleType },
        "routing",
        `rule:${rule.id}`
      );

      if (result.success) {
        console.log(`[Routing] Rule ${rule.id}: SUCCESS - Conversation ${externalConversationId} routed to ${rule.target}`);
        
        if (consumeResult.shouldDeactivate) {
          await routingStorage.deactivateRule(rule.id);
          console.log(`[Routing] Rule ${rule.id}: Deactivated (all slots consumed)`);
        }
      } else {
        console.error(`[Routing] Rule ${rule.id}: FAILED - ${result.error}`);
        trackingSet.delete(externalConversationId);
      }
    } catch (error) {
      console.error(`[Routing] Rule ${rule.id}: ERROR -`, error);
      trackingSet.delete(externalConversationId);
    }

    return;
  }
  
  console.log(`[Routing] No matching rules for conversation ${externalConversationId}`);
}

export function clearProcessedConversations(): void {
  processedAllocateNextN.clear();
  processedTransferOngoing.clear();
}

export const RoutingOrchestrator = {
  processRoutingEvent,
  clearProcessedConversations,
};
