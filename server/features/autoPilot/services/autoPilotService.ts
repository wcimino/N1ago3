import { db } from "../../../db.js";
import { conversations, eventsStandard, responsesSuggested } from "../../../../shared/schema.js";
import { eq, desc, and, ne } from "drizzle-orm";
import * as ZendeskApiService from "../../../services/zendeskApiService.js";

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

async function getLastClientMessage(conversationId: number, excludeEventId?: number) {
  const conditions = [
    eq(eventsStandard.conversationId, conversationId),
    eq(eventsStandard.authorType, "user"),
    eq(eventsStandard.eventType, "message"),
  ];
  
  if (excludeEventId) {
    conditions.push(ne(eventsStandard.id, excludeEventId));
  }
  
  const [lastMessage] = await db.select()
    .from(eventsStandard)
    .where(and(...conditions))
    .orderBy(desc(eventsStandard.occurredAt))
    .limit(1);
  
  return lastMessage || null;
}

async function getSuggestionById(suggestionId: number) {
  const [suggestion] = await db.select()
    .from(responsesSuggested)
    .where(eq(responsesSuggested.id, suggestionId));
  return suggestion || null;
}

async function updateSuggestionStatus(suggestionId: number, status: SuggestionStatus) {
  const updateData: { status: SuggestionStatus; usedAt?: Date } = { status };
  
  if (status === "sent") {
    updateData.usedAt = new Date();
  }
  
  await db.update(responsesSuggested)
    .set(updateData)
    .where(eq(responsesSuggested.id, suggestionId));
}

async function shouldSendResponse(suggestionId: number): Promise<{ shouldSend: boolean; reason: string }> {
  const suggestion = await getSuggestionById(suggestionId);
  
  if (!suggestion) {
    return { shouldSend: false, reason: "suggestion_not_found" };
  }
  
  const conversation = await getConversationByInternalId(suggestion.conversationId);
  
  if (!conversation) {
    return { shouldSend: false, reason: "conversation_not_found" };
  }
  
  if (conversation.currentHandlerName !== "n1ago") {
    return { shouldSend: false, reason: `handler_not_n1ago (current: ${conversation.currentHandlerName})` };
  }
  
  const lastClientMessage = await getLastClientMessage(suggestion.conversationId);
  
  if (!lastClientMessage) {
    return { shouldSend: false, reason: "no_client_message_found" };
  }
  
  if (!suggestion.inResponseTo) {
    return { shouldSend: false, reason: "suggestion_has_no_in_response_to" };
  }
  
  const clientMessageText = lastClientMessage.contentText?.trim().toLowerCase();
  const inResponseToText = suggestion.inResponseTo?.trim().toLowerCase();
  
  if (clientMessageText !== inResponseToText) {
    return { shouldSend: false, reason: `in_response_to_mismatch (expected: "${inResponseToText}", got: "${clientMessageText}")` };
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
  
  const { shouldSend, reason } = await shouldSendResponse(suggestionId);
  
  console.log(`[AutoPilot] Suggestion ${suggestionId} - shouldSend: ${shouldSend}, reason: ${reason}`);
  
  if (!shouldSend) {
    await updateSuggestionStatus(suggestionId, "expired");
    console.log(`[AutoPilot] Suggestion ${suggestionId} marked as expired: ${reason}`);
    return { success: true, action: "expired", reason };
  }
  
  if (!suggestion.externalConversationId) {
    await updateSuggestionStatus(suggestionId, "expired");
    console.log(`[AutoPilot] Suggestion ${suggestionId} has no externalConversationId, marking as expired`);
    return { success: false, action: "expired", reason: "no_external_conversation_id" };
  }
  
  const sendResult = await ZendeskApiService.sendMessage(
    suggestion.externalConversationId,
    suggestion.suggestedResponse,
    "autoPilot",
    `suggestion:${suggestionId}`
  );
  
  if (!sendResult.success) {
    console.error(`[AutoPilot] Failed to send message for suggestion ${suggestionId}: ${sendResult.error}`);
    return { success: false, action: "skipped", reason: `send_failed: ${sendResult.error}` };
  }
  
  await updateSuggestionStatus(suggestionId, "sent");
  console.log(`[AutoPilot] Suggestion ${suggestionId} sent successfully`);
  
  return { success: true, action: "sent", reason: "message_sent" };
}

export const AutoPilotService = {
  processSuggestion,
  shouldSendResponse,
};
