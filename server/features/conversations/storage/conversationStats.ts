import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { sql } from "drizzle-orm";

export const conversationStats = {
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

  async getConversationsGroupedByUser(limit = 50, offset = 0, productStandardFilter?: string, intentFilter?: string, handlerFilter?: string, emotionLevelFilter?: number, clientFilter?: string, userAuthenticatedFilter?: string) {
    const productCondition = productStandardFilter ? sql`AND lc_filter.last_product_standard = ${productStandardFilter}` : sql``;
    const intentCondition = intentFilter ? sql`AND lc_filter.last_intent = ${intentFilter}` : sql``;
    const emotionCondition = emotionLevelFilter ? sql`AND lc_filter.last_customer_emotion_level = ${emotionLevelFilter}` : sql``;
    
    let handlerCondition = sql``;
    if (handlerFilter === 'bot') {
      handlerCondition = sql`AND (LOWER(lc_filter.current_handler_name) LIKE '%answerbot%' OR LOWER(lc_filter.current_handler_name) LIKE '%zd-answerbot%')`;
    } else if (handlerFilter === 'human') {
      handlerCondition = sql`AND (LOWER(lc_filter.current_handler_name) LIKE '%agentworkspace%' OR LOWER(lc_filter.current_handler_name) LIKE '%zd-agentworkspace%')`;
    } else if (handlerFilter === 'n1ago') {
      handlerCondition = sql`AND LOWER(lc_filter.current_handler_name) LIKE '%n1ago%'`;
    }

    let userAuthenticatedCondition = sql``;
    if (userAuthenticatedFilter === 'authenticated') {
      userAuthenticatedCondition = sql`AND lc_filter.user_authenticated = true`;
    } else if (userAuthenticatedFilter === 'not_authenticated') {
      userAuthenticatedCondition = sql`AND (lc_filter.user_authenticated = false OR lc_filter.user_authenticated IS NULL)`;
    }

    const clientSearchPattern = clientFilter ? `%${clientFilter}%` : null;
    const clientCondition = clientFilter ? sql`AND (
      lc_filter.user_id ILIKE ${clientSearchPattern}
      OR lc_filter.profile_given_name ILIKE ${clientSearchPattern}
      OR lc_filter.profile_surname ILIKE ${clientSearchPattern}
      OR lc_filter.profile_email ILIKE ${clientSearchPattern}
      OR CONCAT(lc_filter.profile_given_name, ' ', lc_filter.profile_surname) ILIKE ${clientSearchPattern}
    )` : sql``;

    const userConversations = await db.execute(sql`
      WITH message_count_per_conv AS (
        SELECT 
          conversation_id,
          COUNT(*) as message_count
        FROM events_standard
        WHERE event_type = 'message'
        GROUP BY conversation_id
      ),
      last_message_per_conv AS (
        SELECT 
          conversation_id,
          MAX(occurred_at) as last_message_at
        FROM events_standard
        WHERE event_type = 'message'
        GROUP BY conversation_id
      ),
      last_conv_filter AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          COALESCE(cs.product_standard, cs.product) as last_product_standard,
          cs.intent as last_intent,
          c.current_handler_name,
          cs.customer_emotion_level as last_customer_emotion_level,
          u.profile->>'givenName' as profile_given_name,
          u.profile->>'surname' as profile_surname,
          u.profile->>'email' as profile_email,
          u.authenticated as user_authenticated
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
        LEFT JOIN users u ON c.user_id = u.sunshine_id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, COALESCE(lm.last_message_at, c.created_at) DESC
      ),
      filtered_users AS (
        SELECT user_id FROM last_conv_filter lc_filter
        WHERE 1=1 ${productCondition} ${intentCondition} ${handlerCondition} ${emotionCondition} ${clientCondition} ${userAuthenticatedCondition}
      ),
      user_stats AS (
        SELECT 
          c.user_id,
          COUNT(*) as conversation_count,
          MAX(COALESCE(lm.last_message_at, c.created_at)) as last_activity,
          MIN(c.created_at) as first_activity,
          MAX(c.created_at) as latest_conversation_start,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'external_conversation_id', c.external_conversation_id,
              'status', c.status,
              'closed_at', TO_CHAR(c.closed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'closed_reason', c.closed_reason,
              'created_at', TO_CHAR(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'updated_at', TO_CHAR(COALESCE(lm.last_message_at, c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'product_standard', COALESCE(cs.product_standard, cs.product),
              'intent', cs.intent,
              'current_handler', c.current_handler,
              'current_handler_name', c.current_handler_name,
              'message_count', COALESCE(mc.message_count, 0)
            ) ORDER BY c.created_at ASC
          ) as conversations
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
        LEFT JOIN message_count_per_conv mc ON mc.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
          AND c.user_id IN (SELECT user_id FROM filtered_users)
        GROUP BY c.user_id
        ORDER BY first_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      last_conv AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          COALESCE(cs.product_standard, cs.product) as last_product_standard,
          cs.subproduct as last_subproduct_standard,
          cs.subject as last_subject,
          cs.intent as last_intent,
          cs.customer_emotion_level as last_customer_emotion_level
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, COALESCE(lm.last_message_at, c.created_at) DESC
      )
      SELECT 
        us.user_id,
        us.conversation_count,
        TO_CHAR(us.last_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_activity,
        TO_CHAR(us.first_activity, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_activity,
        TO_CHAR(us.latest_conversation_start, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as latest_conversation_start,
        us.conversations,
        lc.last_product_standard,
        lc.last_subproduct_standard,
        lc.last_subject,
        lc.last_intent,
        lc.last_customer_emotion_level
      FROM user_stats us
      LEFT JOIN last_conv lc ON lc.user_id = us.user_id
      ORDER BY us.first_activity DESC
    `);

    const countResult = await db.execute(sql`
      WITH last_message_per_conv AS (
        SELECT 
          conversation_id,
          MAX(occurred_at) as last_message_at
        FROM events_standard
        WHERE event_type = 'message'
        GROUP BY conversation_id
      ),
      last_conv_filter AS (
        SELECT DISTINCT ON (c.user_id)
          c.user_id,
          COALESCE(cs.product_standard, cs.product) as last_product_standard,
          cs.intent as last_intent,
          c.current_handler_name,
          cs.customer_emotion_level as last_customer_emotion_level,
          u.profile->>'givenName' as profile_given_name,
          u.profile->>'surname' as profile_surname,
          u.profile->>'email' as profile_email,
          u.authenticated as user_authenticated
        FROM conversations c
        LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
        LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
        LEFT JOIN users u ON c.user_id = u.sunshine_id
        WHERE c.user_id IS NOT NULL
        ORDER BY c.user_id, COALESCE(lm.last_message_at, c.created_at) DESC
      )
      SELECT COUNT(*) as count FROM last_conv_filter lc_filter
      WHERE 1=1 ${productCondition} ${intentCondition} ${handlerCondition} ${emotionCondition} ${clientCondition} ${userAuthenticatedCondition}
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
        c.current_handler,
        c.current_handler_name,
        c.closed_at,
        c.closed_reason,
        c.created_at as conv_created_at,
        c.updated_at as conv_updated_at,
        c.metadata_json,
        c.autopilot_enabled,
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
        currentHandler: row.current_handler,
        currentHandlerName: row.current_handler_name,
        closedAt: row.closed_at,
        closedReason: row.closed_reason,
        createdAt: row.conv_created_at,
        updatedAt: row.conv_updated_at,
        metadataJson: row.metadata_json,
        autopilotEnabled: row.autopilot_enabled,
      },
      messages: row.messages || [],
    }));
  },
};
