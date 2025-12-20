import { saveAndDispatchEvent } from "../../events/services/eventDispatcher.js";
import type { ClosedReason } from "../../../config/conversationRules.js";

interface ConversationForEvent {
  id: number;
  externalConversationId: string;
  userExternalId?: string | null;
  closedAt?: Date | null;
}

export async function createConversationClosedEvent(
  conversation: ConversationForEvent,
  reason: ClosedReason
) {
  try {
    const closedAt = conversation.closedAt || new Date();
    const sourceEventId = `close:${conversation.id}:${reason}:${closedAt.toISOString()}`;
    
    await saveAndDispatchEvent({
      eventType: "conversation_closed",
      eventSubtype: reason,
      source: "n1ago",
      sourceEventId,
      externalConversationId: conversation.externalConversationId,
      externalUserId: conversation.userExternalId || undefined,
      authorType: "system",
      authorId: "n1ago",
      authorName: "N1ago System",
      contentText: `Conversa encerrada: ${reason}`,
      occurredAt: closedAt,
      metadata: { reason, closedAt: closedAt.toISOString() },
      conversationId: conversation.id,
    });
    
    console.log(`Created conversation_closed event for conversation ${conversation.id} (${reason})`);
  } catch (error) {
    console.error(`Failed to create conversation_closed event for conversation ${conversation.id}:`, error);
  }
}
