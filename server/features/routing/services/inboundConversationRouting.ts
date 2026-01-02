import { routingStorage } from "../storage/routingStorage.js";
import { routingTrackingStorage } from "../storage/routingTrackingStorage.js";
import { TargetResolver } from "./targetResolver.js";
import { TransferService } from "./transferService.js";
import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import { userStorage } from "../../conversations/storage/userStorage.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import type { RoutingRule } from "../../../../shared/schema.js";

interface InboundEventData {
  externalConversationId: string;
  eventType: string;
  authorType?: string;
  contentText?: string;
  externalUserId?: string;
}

interface RoutingResult {
  routed: boolean;
  ruleId?: number;
  target?: string;
  reason: string;
  durationMs: number;
}

function extractEventDataFromZendeskPayload(payload: any): InboundEventData | null {
  if (!payload) return null;

  const events = payload.events || [];
  
  if (events.length === 0) {
    return null;
  }

  const routableEvent = events.find((event: any) => 
    event.type === "conversation:message" || event.type === "conversation:create"
  );

  if (!routableEvent) {
    return null;
  }

  const eventPayload = routableEvent.payload || {};
  const conversationData = eventPayload.conversation || payload.conversation || {};
  const userData = eventPayload.user || payload.user || payload.appUser;

  if (!conversationData.id) {
    return null;
  }

  let eventType: string;
  let contentText: string | undefined;
  let authorType: string | undefined;

  if (routableEvent.type === "conversation:message") {
    eventType = "message";
    const messages = eventPayload.messages || [];
    const message = messages[0] || eventPayload.message;
    if (message) {
      contentText = message.content?.text;
      const authorTypeRaw = message.author?.type;
      authorType = authorTypeRaw === "user" ? "customer" : authorTypeRaw === "business" ? "agent" : authorTypeRaw === "app" ? "bot" : "system";
    }
  } else if (routableEvent.type === "conversation:create") {
    eventType = "conversation_started";
    authorType = "system";
  } else {
    return null;
  }

  return {
    externalConversationId: conversationData.id,
    eventType,
    authorType,
    contentText,
    externalUserId: userData?.id,
  };
}

function evaluateRule(
  rule: RoutingRule,
  eventData: InboundEventData,
  userAuthenticated: boolean | undefined
): { matches: boolean; reason: string } {
  if (rule.ruleType === "allocate_next_n") {
    if (eventData.eventType !== "conversation_started") {
      return { matches: false, reason: "not conversation_started event" };
    }

    if (!routingStorage.matchesAuthFilter(rule, userAuthenticated)) {
      return { matches: false, reason: `auth filter mismatch (filter=${rule.authFilter}, user=${userAuthenticated})` };
    }

    return { matches: true, reason: "allocate_next_n conditions met" };
  }

  if (rule.ruleType === "transfer_ongoing") {
    if (eventData.eventType !== "message") {
      return { matches: false, reason: "not message event" };
    }

    if (!eventData.authorType || !["customer", "user", "bot", "agent"].includes(eventData.authorType)) {
      return { matches: false, reason: `invalid author type: ${eventData.authorType}` };
    }

    if (!eventData.contentText || eventData.contentText.trim() === "") {
      return { matches: false, reason: "no message text" };
    }

    if (!routingStorage.matchesText(rule.matchText, eventData.contentText)) {
      return { matches: false, reason: `text mismatch` };
    }

    return { matches: true, reason: `text match: "${rule.matchText}"` };
  }

  return { matches: false, reason: `unknown rule type: ${rule.ruleType}` };
}

async function executeRouting(
  rule: RoutingRule,
  externalConversationId: string,
  targetIntegrationId: string
): Promise<{ success: boolean; error?: string }> {
  let slotConsumed = false;
  let trackingAdded = false;

  try {
    const passControlResult = await ZendeskApiService.passControl(
      externalConversationId,
      targetIntegrationId,
      { source: "inbound_routing", ruleId: rule.id, ruleType: rule.ruleType },
      "routing",
      `rule:${rule.id}`
    );

    if (!passControlResult.success) {
      return { success: false, error: `passControl failed: ${passControlResult.error}` };
    }

    await routingTrackingStorage.markConversationProcessed(
      externalConversationId,
      rule.id,
      rule.ruleType
    );
    trackingAdded = true;

    const consumeResult = await routingStorage.tryConsumeRuleSlot(rule.id);

    if (!consumeResult.success) {
      await routingTrackingStorage.removeConversationTracking(externalConversationId, rule.ruleType);
      return { success: false, error: "No available slots" };
    }

    slotConsumed = true;

    try {
      await conversationStorage.updateConversationHandler(
        externalConversationId,
        targetIntegrationId,
        TargetResolver.getHandlerName(rule.target) || rule.target
      );
    } catch (handlerError) {
      console.error(`[InboundRouting] Rule ${rule.id}: Failed to update handler:`, handlerError);
    }

    if (TargetResolver.isN1ago(rule.target)) {
      const tagResult = await ZendeskApiService.addConversationTags(
        externalConversationId,
        TransferService.DEFAULT_N1AGO_TAGS,
        "routing",
        `rule:${rule.id}`
      );

      if (!tagResult.success) {
        console.error(`[InboundRouting] Rule ${rule.id}: Failed to add tag - ${tagResult.error}`);
      }

      const welcomeResult = await ZendeskApiService.sendMessage(
        externalConversationId,
        TransferService.DEFAULT_N1AGO_WELCOME_MESSAGE,
        "routing",
        `rule:${rule.id}`
      );

      if (welcomeResult.success) {
        console.log(`[InboundRouting] Rule ${rule.id}: Welcome message sent`);
      } else {
        console.error(`[InboundRouting] Rule ${rule.id}: Failed to send welcome - ${welcomeResult.error}`);
      }
    }

    if (consumeResult.shouldDeactivate) {
      await routingStorage.deactivateRule(rule.id);
      console.log(`[InboundRouting] Rule ${rule.id}: Deactivated (all slots consumed)`);
    }

    return { success: true };

  } catch (error) {
    console.error(`[InboundRouting] Rule ${rule.id}: Error:`, error);

    if (slotConsumed) {
      try {
        await routingStorage.releaseRuleSlot(rule.id);
      } catch (rollbackError) {
        console.error(`[InboundRouting] Rule ${rule.id}: Failed to rollback slot:`, rollbackError);
      }
    }

    if (trackingAdded) {
      try {
        await routingTrackingStorage.removeConversationTracking(externalConversationId, rule.ruleType);
      } catch (rollbackError) {
        console.error(`[InboundRouting] Rule ${rule.id}: Failed to rollback tracking:`, rollbackError);
      }
    }

    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function hasRoutableEvent(rawPayload: any): boolean {
  const events = rawPayload?.events || [];
  return events.some((event: any) => 
    event.type === "conversation:message" || event.type === "conversation:create"
  );
}

async function tryRouteFromPayload(rawPayload: any, source: string): Promise<RoutingResult> {
  const startTime = Date.now();

  if (source !== "zendesk") {
    return {
      routed: false,
      reason: `Unsupported source: ${source}`,
      durationMs: Date.now() - startTime,
    };
  }

  if (!hasRoutableEvent(rawPayload)) {
    return {
      routed: false,
      reason: "No routable event in payload",
      durationMs: Date.now() - startTime,
    };
  }

  const eventData = extractEventDataFromZendeskPayload(rawPayload);

  if (!eventData) {
    return {
      routed: false,
      reason: "Failed to extract event data",
      durationMs: Date.now() - startTime,
    };
  }

  if (eventData.eventType !== "conversation_started" && eventData.eventType !== "message") {
    return {
      routed: false,
      reason: `Event type not routable: ${eventData.eventType}`,
      durationMs: Date.now() - startTime,
    };
  }

  console.log(`[InboundRouting] Processing: type=${eventData.eventType}, conversation=${eventData.externalConversationId}, author=${eventData.authorType}`);

  let userAuthenticated: boolean | undefined;
  if (eventData.externalUserId) {
    const user = await userStorage.getUserBySunshineId(eventData.externalUserId);
    if (user) {
      userAuthenticated = user.authenticated;
    }
  }

  const activeRules = await routingStorage.getAllActiveRules();

  if (activeRules.length === 0) {
    return {
      routed: false,
      reason: "No active rules",
      durationMs: Date.now() - startTime,
    };
  }

  for (const rule of activeRules) {
    const alreadyProcessed = await routingTrackingStorage.hasProcessedConversation(
      eventData.externalConversationId,
      rule.ruleType
    );

    if (alreadyProcessed) {
      continue;
    }

    const { matches, reason } = evaluateRule(rule, eventData, userAuthenticated);

    if (!matches) {
      console.log(`[InboundRouting] Rule ${rule.id}: no match - ${reason}`);
      continue;
    }

    console.log(`[InboundRouting] Rule ${rule.id}: MATCH - ${reason}`);

    const targetIntegrationId = TargetResolver.getIntegrationId(rule.target);

    if (!targetIntegrationId) {
      console.error(`[InboundRouting] Rule ${rule.id}: Unknown target "${rule.target}"`);
      continue;
    }

    const result = await executeRouting(rule, eventData.externalConversationId, targetIntegrationId);

    if (result.success) {
      console.log(`[InboundRouting] Rule ${rule.id}: SUCCESS - routed to ${rule.target} in ${Date.now() - startTime}ms`);
      return {
        routed: true,
        ruleId: rule.id,
        target: rule.target,
        reason: `Routed by rule ${rule.id}`,
        durationMs: Date.now() - startTime,
      };
    } else {
      console.log(`[InboundRouting] Rule ${rule.id}: FAILED - ${result.error}`);
    }
  }

  return {
    routed: false,
    reason: "No matching rules applied",
    durationMs: Date.now() - startTime,
  };
}

export const InboundConversationRouting = {
  tryRouteFromPayload,
  extractEventDataFromZendeskPayload,
};
