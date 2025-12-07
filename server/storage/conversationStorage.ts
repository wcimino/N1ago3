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
    .where(eq(conversations.externalConversationId, data.externalConversationId));
  
  if (!conversation) {
    [conversation] = await db.insert(conversations).values({
      externalConversationId: data.externalConversationId,
      externalAppId: data.externalAppId,
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

  async getConversationsGroupedByUser(limit = 50, offset = 0, productStandardFilter?: string, intentFilter?: string) {
    const productCondition = productStandardFilter ? sql`AND lc_filter.last_product_standard = ${productStandardFilter}` : sql``;
    const intentCondition = intentFilter ? sql`AND lc_filter.last_intent = ${intentFilter}` : sql``;

    const userConversations = await db.execute(sql`
      WITH last_conv_filter AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          cs.product_standard as last_product_standard,
          cs.intent as last_intent
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, c.updated_at DESC
      ),
      filtered_users AS (
        SELECT user_id FROM last_conv_filter lc_filter
        WHERE 1=1 ${productCondition} ${intentCondition}
      ),
      user_stats AS (
        SELECT 
          c.user_id,
          COUNT(*) as conversation_count,
          MAX(c.updated_at) as last_activity,
          MIN(c.created_at) as first_activity,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'external_conversation_id', c.external_conversation_id,
              'status', c.status,
              'created_at', TO_CHAR(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'updated_at', TO_CHAR(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'product_standard', cs.product_standard,
              'intent', cs.intent
            ) ORDER BY c.created_at ASC
          ) as conversations
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
          AND c.user_id IN (SELECT user_id FROM filtered_users)
        GROUP BY c.user_id
        ORDER BY last_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      last_conv AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          cs.product_standard as last_product_standard,
          cs.intent as last_intent
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, c.updated_at DESC
      )
      SELECT 
        us.user_id,
        us.conversation_count,
        TO_CHAR(us.last_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_activity,
        TO_CHAR(us.first_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_activity,
        us.conversations,
        lc.last_product_standard,
        lc.last_intent
      FROM user_stats us
      LEFT JOIN last_conv lc ON lc.user_id = us.user_id
    `);

    const countResult = await db.execute(sql`
      WITH last_conv_filter AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          cs.product_standard as last_product_standard,
          cs.intent as last_intent
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, c.updated_at DESC
      )
      SELECT COUNT(*) as count FROM last_conv_filter lc_filter
      WHERE 1=1 ${productCondition} ${intentCondition}
    `);

    return { 
      userGroups: userConversations.rows as any[], 
      total: Number((countResult.rows[0] as any).count) 
    };
  },

  async getUserConversationsWithMessages(userId: string) {
    const result = await db.execute(sql`
      SELECT 
        c.id as conv_id,
        c.external_conversation_id,
        c.external_app_id,
        c.user_id,
        c.user_external_id,
        c.status,
        c.created_at as conv_created_at,
        c.updated_at as conv_updated_at,
        c.metadata_json,
        COALESCE(
          JSON_AGG(
            CASE WHEN e.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', e.id,
                'author_type', e.author_type,
                'author_name', e.author_name,
                'content_type', COALESCE(e.event_subtype, 'text'),
                'content_text', e.content_text,
                'content_payload', e.content_payload,
                'received_at', TO_CHAR(e.received_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'zendesk_timestamp', TO_CHAR(e.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
              )
            END ORDER BY e.occurred_at
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) as messages
      FROM conversations c
      LEFT JOIN events_standard e ON e.conversation_id = c.id AND e.event_type = 'message'
      WHERE c.user_id = ${userId}
      GROUP BY c.id
      ORDER BY c.created_at
    `);

    if (result.rows.length === 0) return null;

    return result.rows.map((row: any) => ({
      conversation: {
        id: row.conv_id,
        externalConversationId: row.external_conversation_id,
        externalAppId: row.external_app_id,
        userId: row.user_id,
        userExternalId: row.user_external_id,
        status: row.status,
        createdAt: row.conv_created_at,
        updatedAt: row.conv_updated_at,
        metadataJson: row.metadata_json,
      },
      messages: row.messages || [],
    }));
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
