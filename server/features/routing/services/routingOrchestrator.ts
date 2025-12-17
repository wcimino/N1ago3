import { routingStorage } from "../storage/routingStorage.js";
import { routingTrackingStorage } from "../storage/routingTrackingStorage.js";
import { TargetResolver } from "./targetResolver.js";
import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import { userStorage } from "../../conversations/storage/userStorage.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import type { EventStandard, RoutingRule } from "../../../../shared/schema.js";

function shouldProcessRouting(event: EventStandard): boolean {
  if (event.eventType !== "conversation_started" && event.eventType !== "message") {
    return false;
  }

  if (!event.externalConversationId) {
    return false;
  }

  return true;
}

function evaluateRule(rule: RoutingRule, event: EventStandard, userAuthenticated: boolean | undefined): { matches: boolean; reason: string } {
  if (rule.ruleType === "allocate_next_n") {
    if (event.eventType !== "conversation_started") {
      return { matches: false, reason: "not conversation_started event" };
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
    
    if (event.authorType !== "user" && event.authorType !== "customer" && event.authorType !== "bot" && event.authorType !== "agent") {
      return { matches: false, reason: `invalid author type: ${event.authorType}` };
    }
    
    if (!event.contentText || event.contentText.trim() === "") {
      return { matches: false, reason: "no message text" };
    }
    
    if (!routingStorage.matchesText(rule.matchText, event.contentText)) {
      return { matches: false, reason: `text mismatch (rule="${rule.matchText?.substring(0, 30)}...", msg="${event.contentText.substring(0, 30)}...")` };
    }
    
    return { matches: true, reason: `text match: "${rule.matchText}"` };
  }
  
  return { matches: false, reason: `unknown rule type: ${rule.ruleType}` };
}

async function executeRoutingWithRollback(
  rule: RoutingRule,
  externalConversationId: string,
  targetIntegrationId: string
): Promise<{ success: boolean; error?: string }> {
  let slotConsumed = false;
  let trackingAdded = false;

  try {
    console.log(`[Routing] Rule ${rule.id}: Calling passControl -> ${rule.target}`);
    
    const passControlResult = await ZendeskApiService.passControl(
      externalConversationId,
      targetIntegrationId,
      { source: "routing_rule", ruleId: rule.id, ruleType: rule.ruleType },
      "routing",
      `rule:${rule.id}`
    );

    if (!passControlResult.success) {
      return { success: false, error: `passControl failed: ${passControlResult.error}` };
    }

    console.log(`[Routing] Rule ${rule.id}: passControl SUCCESS, adding tag 'teste_n1ago' to conversation ${externalConversationId}...`);

    const tagResult = await ZendeskApiService.addConversationTags(
      externalConversationId,
      ["teste_n1ago"],
      "routing",
      `rule:${rule.id}`
    );

    if (tagResult.success) {
      console.log(`[Routing] Rule ${rule.id}: Tag 'teste_n1ago' added successfully (status: ${tagResult.status})`);
    } else {
      console.error(`[Routing] Rule ${rule.id}: FAILED to add tag 'teste_n1ago' - error: ${tagResult.error}, status: ${tagResult.status}`);
    }

    console.log(`[Routing] Rule ${rule.id}: Marking as processed...`);

    await routingTrackingStorage.markConversationProcessed(
      externalConversationId,
      rule.id,
      rule.ruleType
    );
    trackingAdded = true;

    console.log(`[Routing] Rule ${rule.id}: Consuming slot...`);

    const consumeResult = await routingStorage.tryConsumeRuleSlot(rule.id);
    
    if (!consumeResult.success) {
      console.log(`[Routing] Rule ${rule.id}: No available slots, rolling back tracking...`);
      await routingTrackingStorage.removeConversationTracking(externalConversationId, rule.ruleType);
      return { success: false, error: "No available slots (race condition)" };
    }
    
    slotConsumed = true;
    console.log(`[Routing] Rule ${rule.id}: Slot consumed (${consumeResult.rule?.allocatedCount}/${consumeResult.rule?.allocateCount})`);

    if (TargetResolver.isN1ago(rule.target)) {
      try {
        await conversationStorage.updateConversationHandler(
          externalConversationId,
          targetIntegrationId,
          TargetResolver.getHandlerName(rule.target) || "n1ago"
        );
        console.log(`[Routing] Rule ${rule.id}: Marked conversation as handled by N1ago`);
      } catch (handlerError) {
        console.error(`[Routing] Rule ${rule.id}: Failed to update handler, but routing succeeded:`, handlerError);
      }
    }
    
    if (consumeResult.shouldDeactivate) {
      await routingStorage.deactivateRule(rule.id);
      console.log(`[Routing] Rule ${rule.id}: Deactivated (all slots consumed)`);
    }

    return { success: true };
    
  } catch (error) {
    console.error(`[Routing] Rule ${rule.id}: ERROR during routing execution:`, error);
    
    if (slotConsumed) {
      try {
        await routingStorage.releaseRuleSlot(rule.id);
        console.log(`[Routing] Rule ${rule.id}: Rolled back slot consumption`);
      } catch (rollbackError) {
        console.error(`[Routing] Rule ${rule.id}: Failed to rollback slot:`, rollbackError);
      }
    }
    
    if (trackingAdded) {
      try {
        await routingTrackingStorage.removeConversationTracking(externalConversationId, rule.ruleType);
        console.log(`[Routing] Rule ${rule.id}: Rolled back tracking`);
      } catch (rollbackError) {
        console.error(`[Routing] Rule ${rule.id}: Failed to rollback tracking:`, rollbackError);
      }
    }
    
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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
    const alreadyProcessed = await routingTrackingStorage.hasProcessedConversation(
      externalConversationId,
      rule.ruleType
    );
    
    if (alreadyProcessed) {
      console.log(`[Routing] Rule ${rule.id} (${rule.ruleType}): skipped - conversation already processed for this rule type`);
      continue;
    }

    const { matches, reason } = evaluateRule(rule, event, userAuthenticated);
    
    console.log(`[Routing] Rule ${rule.id} (${rule.ruleType}): ${matches ? "MATCH" : "no match"} - ${reason}`);
    
    if (!matches) {
      continue;
    }

    const targetIntegrationId = TargetResolver.getIntegrationId(rule.target);
    
    if (!targetIntegrationId) {
      console.error(`[Routing] Rule ${rule.id}: Unknown target "${rule.target}"`);
      continue;
    }

    const routingResult = await executeRoutingWithRollback(rule, externalConversationId, targetIntegrationId);

    if (routingResult.success) {
      console.log(`[Routing] Rule ${rule.id}: SUCCESS - Conversation ${externalConversationId} routed to ${rule.target}`);
      return;
    } else {
      console.log(`[Routing] Rule ${rule.id}: FAILED - ${routingResult.error}, trying next rule...`);
      continue;
    }
  }
  
  console.log(`[Routing] No matching rules successfully applied for conversation ${externalConversationId}`);
}

export const RoutingOrchestrator = {
  processRoutingEvent,
};
