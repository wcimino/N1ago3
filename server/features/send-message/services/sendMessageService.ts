import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, and, gt } from "drizzle-orm";
import * as ZendeskApiService from "../../external-sources/zendesk/services/zendeskApiService.js";

export type MessageType = "response" | "transfer";
export type MessageSource = "autopilot" | "orchestrator" | "solution_provider";

export interface SendMessageRequest {
  conversationId: number;
  externalConversationId: string;
  message: string;
  type: MessageType;
  source: MessageSource;
  lastEventId?: number;
  inResponseTo?: string;
}

export interface SendMessageResult {
  sent: boolean;
  reason: string;
}

async function getConversationById(conversationId: number) {
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

function isN1agoHandler(conversation: { currentHandler: string | null; currentHandlerName: string | null }): boolean {
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  return conversation.currentHandler === n1agoIntegrationId || 
    conversation.currentHandlerName?.startsWith("n1ago") || false;
}

async function validateMessage(request: SendMessageRequest): Promise<SendMessageResult> {
  const { conversationId, type, lastEventId, inResponseTo } = request;

  const conversation = await getConversationById(conversationId);
  
  if (!conversation) {
    return { sent: false, reason: "conversation_not_found" };
  }

  if (!isN1agoHandler(conversation)) {
    return { sent: false, reason: `handler_not_n1ago (handler: ${conversation.currentHandler}, name: ${conversation.currentHandlerName})` };
  }

  if (type === "transfer") {
    return { sent: true, reason: "validation_passed" };
  }

  if (!conversation.autopilotEnabled) {
    return { sent: false, reason: "autopilot_disabled_for_conversation" };
  }

  if (!lastEventId) {
    return { sent: false, reason: "missing_last_event_id" };
  }

  const hasNewer = await hasNewerEvents(conversationId, lastEventId);
  if (hasNewer) {
    return { sent: false, reason: "newer_messages_exist_after_suggestion" };
  }

  const lastMessage = await getLastMessage(conversationId);
  
  if (!lastMessage) {
    return { sent: false, reason: "no_message_found" };
  }

  if (lastMessage.authorType !== "customer") {
    return { sent: false, reason: `last_message_not_from_client (authorType: ${lastMessage.authorType})` };
  }

  if (!inResponseTo) {
    return { sent: false, reason: "missing_in_response_to" };
  }

  const inResponseToEventId = parseInt(inResponseTo, 10);
  
  if (!isNaN(inResponseToEventId)) {
    if (lastMessage.id !== inResponseToEventId) {
      return { sent: false, reason: `in_response_to_id_mismatch (expected: ${inResponseToEventId}, got: ${lastMessage.id})` };
    }
  } else {
    const normalize = (text: string | null | undefined): string => 
      (text || "").trim().toLowerCase().replace(/\s+/g, " ");
    
    const clientMessageText = normalize(lastMessage.contentText);
    const inResponseToText = normalize(inResponseTo);
    
    if (clientMessageText !== inResponseToText) {
      return { sent: false, reason: `in_response_to_text_mismatch (legacy)` };
    }
  }

  return { sent: true, reason: "validation_passed" };
}

export async function send(request: SendMessageRequest): Promise<SendMessageResult> {
  const { conversationId, externalConversationId, message, type, source } = request;
  
  console.log(`[SendMessageService] Processing ${type} message for conversation ${conversationId}, source: ${source}`);

  const validation = await validateMessage(request);
  
  if (!validation.sent) {
    console.log(`[SendMessageService] Validation failed: ${validation.reason}`);
    return validation;
  }

  const contextId = type === "transfer" 
    ? `transfer:${conversationId}` 
    : `${source}:${conversationId}`;

  const sendResult = await ZendeskApiService.sendMessage(
    externalConversationId,
    message,
    source,
    contextId
  );

  if (!sendResult.success) {
    console.error(`[SendMessageService] Failed to send message: ${sendResult.error}`);
    return { sent: false, reason: `send_failed: ${sendResult.error}` };
  }

  console.log(`[SendMessageService] Message sent successfully`);
  return { sent: true, reason: "message_sent" };
}

export const SendMessageService = {
  send,
  validateMessage,
};
