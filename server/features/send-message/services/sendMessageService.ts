import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, and, gt } from "drizzle-orm";
import * as ZendeskApiService from "../../external-sources/zendesk/services/zendeskApiService.js";
import { ResponseFormatterService } from "./responseFormatterService.js";
import { conversationOrchestratorState } from "../../conversations/storage/conversationOrchestratorState.js";

export type MessageType = "response" | "transfer";
export type MessageSource = "autopilot" | "orchestrator" | "solution_provider" | "response_formatter";

export interface SendMessageRequest {
  conversationId: number;
  externalConversationId: string;
  message: string;
  type: MessageType;
  source: MessageSource;
  lastEventId?: number;
  inResponseTo?: string;
  skipFormatting?: boolean;
}

export interface SendMessageResult {
  sent: boolean;
  reason: string;
  wasFormatted?: boolean;
  formattingLogId?: number;
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

  const lastMessage = await getLastMessage(conversationId);
  
  if (!lastMessage) {
    return { sent: false, reason: "no_message_found" };
  }

  // Se a última mensagem for do agente, permite enviar sem validar hasNewerEvents e inResponseTo
  // Isso permite que agentes (ex: Closer) enviem follow-up após outro agente (ex: Solution Provider)
  if (lastMessage.authorType !== "customer") {
    return { sent: true, reason: "validation_passed_last_message_from_agent" };
  }

  // A partir daqui, a última mensagem é do cliente - exige hasNewerEvents check e inResponseTo válido
  
  // Verifica se é a primeira mensagem do Closer (pode ignorar inResponseTo)
  const orchestratorState = await conversationOrchestratorState.getOrchestratorState(conversationId);
  const isCloserFirstMessage = 
    orchestratorState.conversationOwner === "closer" && 
    orchestratorState.waitingForCustomer === false;
  
  if (isCloserFirstMessage) {
    return { sent: true, reason: "validation_passed_closer_first_message" };
  }

  const hasNewer = await hasNewerEvents(conversationId, lastEventId);
  if (hasNewer) {
    return { sent: false, reason: "newer_messages_exist_after_suggestion" };
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
  const { conversationId, externalConversationId, message, type, source, skipFormatting } = request;
  
  console.log(`[SendMessageService] Processing ${type} message for conversation ${conversationId}, source: ${source}`);

  const validation = await validateMessage(request);
  
  if (!validation.sent) {
    console.log(`[SendMessageService] Validation failed: ${validation.reason}`);
    return validation;
  }

  let finalMessage = message;
  let wasFormatted = false;
  let formattingLogId: number | undefined;
  
  if (type !== "transfer" && !skipFormatting) {
    const formatResult = await ResponseFormatterService.formatMessage({
      message,
      conversationId,
      externalConversationId,
    });
    
    if (formatResult.wasFormatted) {
      console.log(`[SendMessageService] Message formatted by ResponseFormatterService, logId: ${formatResult.logId}`);
      finalMessage = formatResult.formattedMessage;
      wasFormatted = true;
      formattingLogId = formatResult.logId;
    }
  }

  const effectiveSource = wasFormatted ? "response_formatter" : source;
  const contextId = type === "transfer" 
    ? `transfer:${conversationId}` 
    : `${effectiveSource}:${conversationId}`;

  const sendResult = await ZendeskApiService.sendMessage(
    externalConversationId,
    finalMessage,
    effectiveSource,
    contextId
  );

  if (!sendResult.success) {
    console.error(`[SendMessageService] Failed to send message: ${sendResult.error}`);
    return { sent: false, reason: `send_failed: ${sendResult.error}` };
  }

  console.log(`[SendMessageService] Message sent successfully, formatted: ${wasFormatted}`);
  return { sent: true, reason: "message_sent", wasFormatted, formattingLogId };
}

export const SendMessageService = {
  send,
  validateMessage,
};
