import { db } from "../db.js";
import { conversations, eventsStandard } from "../../shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import type { ExtractedConversation } from "../adapters/types.js";

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
    .where(eq(conversations.zendeskConversationId, data.externalConversationId));
  
  if (!conversation) {
    [conversation] = await db.insert(conversations).values({
      zendeskConversationId: data.externalConversationId,
      zendeskAppId: data.externalAppId,
      userId: data.externalUserId,
      userExternalId: data.userExternalId,
      metadataJson: data.metadata,
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

export const conversationStorage = {
  async getOrCreateConversation(zendeskConversationId: string, zendeskAppId?: string, userData?: any) {
    return upsertConversation({
      externalConversationId: zendeskConversationId,
      externalAppId: zendeskAppId,
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

  async getConversationMessages(zendeskConversationId: string) {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.zendeskConversationId, zendeskConversationId));
    
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

  async getConversationsStats() {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(conversations);
    const [{ active }] = await db.select({ 
      active: sql<number>`count(*) filter (where status = 'active')` 
    }).from(conversations);
    const [{ totalMessages }] = await db.select({ 
      totalMessages: sql<number>`count(*) filter (where event_type = 'message')` 
    }).from(eventsStandard);
    
    return {
      total: Number(total),
      active: Number(active),
      closed: Number(total) - Number(active),
      totalMessages: Number(totalMessages),
    };
  },

  async getConversationsGroupedByUser(limit = 50, offset = 0) {
    const userConversations = await db.execute(sql`
      WITH user_stats AS (
        SELECT 
          user_id,
          COUNT(*) as conversation_count,
          MAX(updated_at) as last_activity,
          MIN(created_at) as first_activity,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', id,
              'zendesk_conversation_id', zendesk_conversation_id,
              'status', status,
              'created_at', TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'updated_at', TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ) ORDER BY created_at ASC
          ) as conversations
        FROM conversations
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY last_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT 
        user_id,
        conversation_count,
        TO_CHAR(last_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_activity,
        TO_CHAR(first_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_activity,
        conversations
      FROM user_stats
    `);

    const [{ count }] = await db.select({ 
      count: sql<number>`COUNT(DISTINCT user_id)` 
    }).from(conversations).where(sql`user_id IS NOT NULL`);

    return { 
      userGroups: userConversations.rows as any[], 
      total: Number(count) 
    };
  },

  async getUserConversationsWithMessages(userId: string) {
    const userConvs = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.createdAt);

    if (userConvs.length === 0) return null;

    const conversationsWithMessages = await Promise.all(
      userConvs.map(async (conv) => {
        const msgs = await db.select()
          .from(eventsStandard)
          .where(and(
            eq(eventsStandard.conversationId, conv.id),
            eq(eventsStandard.eventType, 'message')
          ))
          .orderBy(eventsStandard.occurredAt);
        
        return {
          conversation: conv,
          messages: msgs.map(e => ({
            id: e.id,
            author_type: e.authorType,
            author_name: e.authorName,
            content_type: e.eventSubtype || 'text',
            content_text: e.contentText,
            content_payload: e.contentPayload,
            received_at: e.receivedAt?.toISOString(),
            zendesk_timestamp: e.occurredAt?.toISOString(),
          })),
        };
      })
    );

    return conversationsWithMessages;
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
};
