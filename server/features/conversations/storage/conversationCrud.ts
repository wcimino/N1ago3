import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import type { ExtractedConversation } from "../../../adapters/types.js";

interface ConversationData {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}

async function upsertConversation(data: ConversationData) {
  let [conversation] = await db.select()
    .from(conversations)
    .where(eq(conversations.externalConversationId, data.externalConversationId));
  
  if (!conversation) {
    [conversation] = await db.insert(conversations).values({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
      userId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadataJson: data.metadata,
      currentHandler: "64d65d81a40bc6cf30ebfbb1",
      currentHandlerName: "zd-answerBot",
    }).returning();
  } else {
    const updates: any = { updatedAt: new Date() };
    
    if (!conversation.userId && data.externalUserId) {
      updates.userId = data.externalUserId;
      updates.userExternalId = data.userExternalId;
      updates.metadataJson = data.metadata;
    }
    
    [conversation] = await db.update(conversations)
      .set(updates)
      .where(eq(conversations.id, conversation.id))
      .returning();
  }
  
  return conversation;
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
};
