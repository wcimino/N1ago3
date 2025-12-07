import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, sql, and, lt, ne } from "drizzle-orm";
import type { ExtractedConversation } from "../../../adapters/types.js";
import { CONVERSATION_RULES, type ClosedReason } from "../../../config/conversationRules.js";
import { eventStorage } from "../../events/storage/eventStorage.js";

interface ConversationData {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}

async function createConversationClosedEvent(
  conversation: { id: number; externalConversationId: string; userExternalId?: string | null; closedAt?: Date | null },
  reason: ClosedReason
) {
  try {
    const closedAt = conversation.closedAt || new Date();
    const sourceEventId = `close:${conversation.id}:${reason}:${closedAt.toISOString()}`;
    
    await eventStorage.saveStandardEvent({
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

async function upsertConversation(data: ConversationData) {
  const existing = await db.select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.externalConversationId, data.externalConversationId))
    .limit(1);
  
  const isNewConversation = existing.length === 0;

  const [conversation] = await db.insert(conversations)
    .values({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
      userId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadataJson: data.metadata,
      currentHandler: "64d65d81a40bc6cf30ebfbb1",
      currentHandlerName: "zd-answerBot",
    })
    .onConflictDoUpdate({
      target: conversations.externalConversationId,
      set: {
        updatedAt: new Date(),
        userId: sql`CASE WHEN ${conversations.userId} IS NULL THEN excluded.user_id ELSE ${conversations.userId} END`,
        userExternalId: sql`CASE WHEN ${conversations.userExternalId} IS NULL THEN excluded.user_external_id ELSE ${conversations.userExternalId} END`,
        metadataJson: sql`CASE WHEN ${conversations.metadataJson} IS NULL THEN excluded.metadata_json ELSE ${conversations.metadataJson} END`,
      },
    })
    .returning();
  
  if (isNewConversation && data.userExternalId && CONVERSATION_RULES.CLOSE_PREVIOUS_ON_NEW) {
    try {
      const closed = await closePreviousConversationsForUser(data.userExternalId, conversation.id);
      if (closed.length > 0) {
        console.log(`Closed ${closed.length} previous conversations for user ${data.userExternalId}`);
      }
    } catch (error) {
      console.error(`Failed to close previous conversations for user ${data.userExternalId}:`, error);
    }
  }
  
  return conversation;
}

async function closePreviousConversationsForUser(userExternalId: string, excludeConversationId: number) {
  const result = await db.update(conversations)
    .set({
      status: 'closed',
      closedAt: new Date(),
      closedReason: 'new_conversation',
      updatedAt: new Date(),
    })
    .where(and(
      eq(conversations.userExternalId, userExternalId),
      eq(conversations.status, 'active'),
      ne(conversations.id, excludeConversationId)
    ))
    .returning();
  
  for (const conv of result) {
    await createConversationClosedEvent(conv, 'new_conversation');
  }
  
  return result;
}

export const conversationCrud = {
  async getOrCreateConversation(externalConversationId: string, externalAppId?: string, userData?: any) {
    return upsertConversation({
      externalConversationId: externalConversationId,
      externalAppId: externalAppId,
      externalUserId: userData?.id,
      userExternalId: userData?.externalId,
      metadata: userData,
    });
  },

  async getConversations(limit = 50, offset = 0) {
    const convs = await db.select().from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    
    return { conversations: convs, total: Number(count) };
  },

  async getConversationMessages(externalConversationId: string) {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.externalConversationId, externalConversationId));
    
    if (!conversation) return null;
    
    const msgs = await db.select()
      .from(eventsStandard)
      .where(and(
        eq(eventsStandard.conversationId, conversation.id),
        eq(eventsStandard.eventType, 'message')
      ))
      .orderBy(eventsStandard.occurredAt);
    
    return { 
      conversation, 
      messages: msgs.map(e => ({
        id: e.id,
        conversationId: e.conversationId,
        zendeskMessageId: e.sourceEventId,
        authorType: e.authorType,
        authorId: e.authorId,
        authorName: e.authorName,
        contentType: e.eventSubtype || 'text',
        contentText: e.contentText,
        contentPayload: e.contentPayload,
        zendeskTimestamp: e.occurredAt,
        receivedAt: e.receivedAt,
        metadataJson: e.metadata,
      }))
    };
  },

  async getOrCreateConversationByExternalId(data: ExtractedConversation) {
    return upsertConversation({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
      externalUserId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadata: data.metadata,
    });
  },

  async updateConversationHandler(externalConversationId: string, handlerId: string, handlerName: string) {
    const result = await db.update(conversations)
      .set({
        currentHandler: handlerId,
        currentHandlerName: handlerName,
        updatedAt: new Date(),
      })
      .where(eq(conversations.externalConversationId, externalConversationId))
      .returning();
    
    return result[0] || null;
  },

  async closeConversation(conversationId: number, reason: ClosedReason) {
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    
    if (result[0]) {
      await createConversationClosedEvent(result[0], reason);
    }
    
    return result[0] || null;
  },

  async closeUserPreviousConversations(userExternalId: string, excludeConversationId?: number) {
    const conditions = [
      eq(conversations.userExternalId, userExternalId),
      eq(conversations.status, 'active'),
    ];
    
    if (excludeConversationId) {
      conditions.push(ne(conversations.id, excludeConversationId));
    }

    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'new_conversation',
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'new_conversation');
    }
    
    return result;
  },

  async getInactiveConversations(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime)
      ))
      .orderBy(conversations.updatedAt)
      .limit(limit);
    
    return result;
  },

  async closeInactiveConversations(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'inactivity',
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime),
        sql`id IN (SELECT id FROM conversations WHERE status = 'active' AND updated_at < ${cutoffTime} ORDER BY updated_at LIMIT ${limit})`
      ))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'inactivity');
    }
    
    return result;
  },

  async countInactiveConversations() {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime)
      ));
    
    return Number(count);
  },

  async closeInactiveConversationsManual(limit: number = 10) {
    const cutoffTime = new Date(Date.now() - CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await db.update(conversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'manual',
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, cutoffTime),
        sql`id IN (SELECT id FROM conversations WHERE status = 'active' AND updated_at < ${cutoffTime} ORDER BY updated_at LIMIT ${limit})`
      ))
      .returning();
    
    for (const conv of result) {
      await createConversationClosedEvent(conv, 'manual');
    }
    
    return result;
  },

  async updateExternalStatus(externalConversationId: string, externalStatus: string) {
    const result = await db.update(conversations)
      .set({
        externalStatus,
        updatedAt: new Date(),
      })
      .where(eq(conversations.externalConversationId, externalConversationId))
      .returning();
    
    return result[0] || null;
  },
};
