import { db } from "../../../db.js";
import { conversations, eventsStandard, responsesSuggested } from "../../../../shared/schema.js";
import { eq, desc, and, gt } from "drizzle-orm";
import * as ZendeskApiService from "../../external-sources/zendesk/services/zendeskApiService.js";

type SuggestionStatus = "created" | "sent" | "expired";

interface AutoPilotResult {
  success: boolean;
  action: "sent" | "expired" | "skipped";
  reason?: string;
}

async function getConversationByInternalId(conversationId: number) {
  const [conversation] = await db.select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  return conversation || null;
}

async function getLastMessage(conversationId: number) {
  const [lastMessage] = await db.select()
    .from(eventsStandard)
    .where(and(
      eq(eventsStandard.conversationId, conversationId),
      eq(eventsStandard.eventType, "message")
    ))
    .orderBy(desc(eventsStandard.id))
    .limit(1);
  
  return lastMessage || null;
}

async function hasNewerEvents(conversationId: number, afterEventId: number): Promise<boolean> {
  const [newerEvent] = await db.select({ id: eventsStandard.id })
    .from(eventsStandard)
    .where(and(
      eq(eventsStandard.conversationId, conversationId),
      eq(eventsStandard.eventType, "message"),
      gt(eventsStandard.id, afterEventId)
    ))
    .limit(1);
  
  return !!newerEvent;
}

async function getSuggestionById(suggestionId: number) {
  const [suggestion] = await db.select()
    .from(responsesSuggested)
    .where(eq(responsesSuggested.id, suggestionId));
  return suggestion || null;
}

async function updateSuggestionStatus(suggestionId: number, status: SuggestionStatus, currentStatus?: string): Promise<boolean> {
  const updateData: { status: SuggestionStatus; usedAt?: Date } = { status };
  
  if (status === "sent") {
    updateData.usedAt = new Date();
  }
  
  const result = await db.update(responsesSuggested)
    .set(updateData)
    .where(and(
      eq(responsesSuggested.id, suggestionId),
      currentStatus ? eq(responsesSuggested.status, currentStatus) : undefined
    ));
  
  return (result.rowCount ?? 0) > 0;
}

async function shouldSendResponse(suggestion: typeof responsesSuggested.$inferSelect): Promise<{ shouldSend: boolean; reason: string }> {
  const conversation = await getConversationByInternalId(suggestion.conversationId);
  
  if (!conversation) {
    return { shouldSend: false, reason: "conversation_not_found" };
  }
  
  if (!conversation.autopilotEnabled) {
    return { shouldSend: false, reason: "autopilot_disabled_for_conversation" };
  }
  
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  const isN1agoHandler = conversation.currentHandler === n1agoIntegrationId || 
    conversation.currentHandlerName?.startsWith("n1ago");
  
  if (!isN1agoHandler) {
    return { shouldSend: false, reason: `handler_not_n1ago (handler: ${conversation.currentHandler}, name: ${conversation.currentHandlerName})` };
  }
  
  if (!suggestion.lastEventId) {
    return { shouldSend: false, reason: "suggestion_has_no_last_event_id" };
  }
  
  const hasNewer = await hasNewerEvents(suggestion.conversationId, suggestion.lastEventId);
  if (hasNewer) {
    return { shouldSend: false, reason: "newer_messages_exist_after_suggestion" };
  }
  
  const lastMessage = await getLastMessage(suggestion.conversationId);
  
  if (!lastMessage) {
    return { shouldSend: false, reason: "no_message_found" };
  }
  
  if (lastMessage.authorType !== "customer") {
    return { shouldSend: false, reason: `last_message_not_from_client (authorType: ${lastMessage.authorType})` };
  }
  
  if (!suggestion.inResponseTo) {
    return { shouldSend: false, reason: "suggestion_has_no_in_response_to" };
  }
  
  const inResponseToEventId = parseInt(suggestion.inResponseTo, 10);
  
  if (!isNaN(inResponseToEventId)) {
    if (lastMessage.id !== inResponseToEventId) {
      return { shouldSend: false, reason: `in_response_to_id_mismatch (expected: ${inResponseToEventId}, got: ${lastMessage.id})` };
    }
  } else {
    const normalize = (text: string | null | undefined): string => 
      (text || "").trim().toLowerCase().replace(/\s+/g, " ");
    
    const clientMessageText = normalize(lastMessage.contentText);
    const inResponseToText = normalize(suggestion.inResponseTo);
    
    if (clientMessageText !== inResponseToText) {
      return { shouldSend: false, reason: `in_response_to_text_mismatch (legacy)` };
    }
  }
  
  return { shouldSend: true, reason: "all_conditions_met" };
}

export async function processSuggestion(suggestionId: number): Promise<AutoPilotResult> {
  console.log(`[AutoPilot] Processing suggestion ${suggestionId}`);
  
  const suggestion = await getSuggestionById(suggestionId);
  
  if (!suggestion) {
    console.error(`[AutoPilot] Suggestion ${suggestionId} not found`);
    return { success: false, action: "skipped", reason: "suggestion_not_found" };
  }
  
  if (suggestion.status !== "created") {
    console.log(`[AutoPilot] Suggestion ${suggestionId} already processed (status: ${suggestion.status})`);
    return { success: true, action: "skipped", reason: `already_${suggestion.status}` };
  }
  
  if (!suggestion.externalConversationId) {
    await updateSuggestionStatus(suggestionId, "expired", "created");
    console.log(`[AutoPilot] Suggestion ${suggestionId} has no externalConversationId, marking as expired`);
    return { success: true, action: "expired", reason: "no_external_conversation_id" };
  }
  
  const { shouldSend, reason } = await shouldSendResponse(suggestion);
  
  console.log(`[AutoPilot] Suggestion ${suggestionId} - shouldSend: ${shouldSend}, reason: ${reason}`);
  
  if (!shouldSend) {
    await updateSuggestionStatus(suggestionId, "expired", "created");
    console.log(`[AutoPilot] Suggestion ${suggestionId} marked as expired: ${reason}`);
    return { success: true, action: "expired", reason };
  }
  
  const updated = await updateSuggestionStatus(suggestionId, "sent", "created");
  
  if (!updated) {
    console.log(`[AutoPilot] Suggestion ${suggestionId} was already processed by another process`);
    return { success: true, action: "skipped", reason: "already_processed_by_another_process" };
  }
  
  const sendResult = await ZendeskApiService.sendMessage(
    suggestion.externalConversationId,
    suggestion.suggestedResponse,
    "autoPilot",
    `suggestion:${suggestionId}`
  );
  
  if (!sendResult.success) {
    await updateSuggestionStatus(suggestionId, "expired");
    console.error(`[AutoPilot] Failed to send message for suggestion ${suggestionId}: ${sendResult.error}, marked as expired`);
    return { success: false, action: "expired", reason: `send_failed: ${sendResult.error}` };
  }
  
  console.log(`[AutoPilot] Suggestion ${suggestionId} sent successfully`);
  
  return { success: true, action: "sent", reason: "message_sent" };
}

export const AutoPilotService = {
  processSuggestion,
  shouldSendResponse,
};
