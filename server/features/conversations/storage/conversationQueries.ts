import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { buildFiltersForGroupedByUser, buildFiltersForConversationList } from "./conversationFilters.js";

interface GroupedByUserParams {
  limit?: number;
  offset?: number;
  productStandardFilter?: string;
  handlerFilter?: string;
  emotionLevelFilter?: number;
  clientFilter?: string;
  userAuthenticatedFilter?: string;
  handledByN1agoFilter?: string;
}

interface ConversationsListParams {
  limit?: number;
  offset?: number;
  productStandardFilter?: string;
  handlerFilter?: string;
  emotionLevelFilter?: number;
  clientFilter?: string;
  userAuthenticatedFilter?: string;
  handledByN1agoFilter?: string;
  objectiveProblemFilter?: string;
  productIdFilter?: number;
  customerRequestTypeFilter?: string;
}

export async function getConversationsGroupedByUser(params: GroupedByUserParams = {}) {
  const { limit = 50, offset = 0 } = params;

  const {
    productCondition,
    emotionCondition,
    handlerCondition,
    userAuthenticatedCondition,
    handledByN1agoCondition,
    clientCondition,
  } = buildFiltersForGroupedByUser(params);

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
    user_n1ago_status AS (
      SELECT 
        c.user_id,
        BOOL_OR(c.handled_by_n1ago) as has_n1ago_conversation
      FROM conversations c
      WHERE c.user_id IS NOT NULL
      GROUP BY c.user_id
    ),
    last_conv_filter AS (
      SELECT DISTINCT ON (c.user_id)
        c.user_id,
        COALESCE(pc.produto || COALESCE(' - ' || pc.subproduto, ''), 'Sem classificação') as last_product_standard,
        c.current_handler_name,
        cs.customer_emotion_level as last_customer_emotion_level,
        u.profile->>'givenName' as profile_given_name,
        u.profile->>'surname' as profile_surname,
        u.profile->>'email' as profile_email,
        u.authenticated as user_authenticated,
        uns.has_n1ago_conversation
      FROM conversations c
      LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
      LEFT JOIN products_catalog pc ON pc.id = cs.product_id
      LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
      LEFT JOIN users u ON c.user_id = u.sunshine_id
      LEFT JOIN user_n1ago_status uns ON uns.user_id = c.user_id
      WHERE c.user_id IS NOT NULL
      ORDER BY c.user_id, COALESCE(lm.last_message_at, c.created_at) DESC
    ),
    filtered_users AS (
      SELECT user_id FROM last_conv_filter lc_filter
      WHERE 1=1 ${productCondition} ${handlerCondition} ${emotionCondition} ${clientCondition} ${userAuthenticatedCondition} ${handledByN1agoCondition}
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
            'product_standard', COALESCE(pc.produto || COALESCE(' - ' || pc.subproduto, ''), NULL),
            'current_handler', c.current_handler,
            'current_handler_name', c.current_handler_name,
            'message_count', COALESCE(mc.message_count, 0)
          ) ORDER BY c.created_at ASC
        ) as conversations
      FROM conversations c
      LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
      LEFT JOIN products_catalog pc ON pc.id = cs.product_id
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
        pc.produto as last_product_standard,
        pc.subproduto as last_subproduct_standard,
        cs.customer_emotion_level as last_customer_emotion_level
      FROM conversations c
      LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
      LEFT JOIN products_catalog pc ON pc.id = cs.product_id
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
    user_n1ago_status AS (
      SELECT 
        c.user_id,
        BOOL_OR(c.handled_by_n1ago) as has_n1ago_conversation
      FROM conversations c
      WHERE c.user_id IS NOT NULL
      GROUP BY c.user_id
    ),
    last_conv_filter AS (
      SELECT DISTINCT ON (c.user_id)
        c.user_id,
        COALESCE(pc.produto || COALESCE(' - ' || pc.subproduto, ''), 'Sem classificação') as last_product_standard,
        c.current_handler_name,
        cs.customer_emotion_level as last_customer_emotion_level,
        u.profile->>'givenName' as profile_given_name,
        u.profile->>'surname' as profile_surname,
        u.profile->>'email' as profile_email,
        u.authenticated as user_authenticated,
        uns.has_n1ago_conversation
      FROM conversations c
      LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
      LEFT JOIN products_catalog pc ON pc.id = cs.product_id
      LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
      LEFT JOIN users u ON c.user_id = u.sunshine_id
      LEFT JOIN user_n1ago_status uns ON uns.user_id = c.user_id
      WHERE c.user_id IS NOT NULL
      ORDER BY c.user_id, COALESCE(lm.last_message_at, c.created_at) DESC
    )
    SELECT COUNT(*) as count FROM last_conv_filter lc_filter
    WHERE 1=1 ${productCondition} ${handlerCondition} ${emotionCondition} ${clientCondition} ${userAuthenticatedCondition} ${handledByN1agoCondition}
  `);

  return { 
    userGroups: userConversations.rows as any[], 
    total: Number((countResult.rows[0] as any).count) 
  };
}

export async function getConversationsList(params: ConversationsListParams = {}) {
  const { limit = 50, offset = 0 } = params;

  const {
    productCondition,
    emotionCondition,
    handlerCondition,
    userAuthenticatedCondition,
    handledByN1agoCondition,
    clientCondition,
    objectiveProblemCondition,
    customerRequestTypeCondition,
  } = buildFiltersForConversationList(params);

  const conversationsResult = await db.execute(sql`
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
    )
    SELECT 
      c.id,
      c.external_conversation_id,
      c.user_id,
      c.status,
      TO_CHAR(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      TO_CHAR(COALESCE(lm.last_message_at, c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
      TO_CHAR(c.closed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as closed_at,
      c.closed_reason,
      c.current_handler,
      c.current_handler_name,
      COALESCE(mc.message_count, 0) as message_count,
      pc.produto as product_standard,
      pc.subproduto as subproduct_standard,
      cs.customer_emotion_level,
      cs.customer_request_type,
      cs.objective_problems,
      u.id as user_db_id,
      u.external_id as user_external_id,
      u.authenticated as user_authenticated,
      u.profile as user_profile
    FROM conversations c
    LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
    LEFT JOIN products_catalog pc ON pc.id = cs.product_id
    LEFT JOIN last_message_per_conv lm ON lm.conversation_id = c.id
    LEFT JOIN message_count_per_conv mc ON mc.conversation_id = c.id
    LEFT JOIN users u ON c.user_id = u.sunshine_id
    WHERE c.user_id IS NOT NULL
      ${productCondition}
      ${handlerCondition}
      ${emotionCondition}
      ${clientCondition}
      ${userAuthenticatedCondition}
      ${handledByN1agoCondition}
      ${objectiveProblemCondition}
      ${customerRequestTypeCondition}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM conversations c
    LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
    LEFT JOIN products_catalog pc ON pc.id = cs.product_id
    LEFT JOIN users u ON c.user_id = u.sunshine_id
    WHERE c.user_id IS NOT NULL
      ${productCondition}
      ${handlerCondition}
      ${emotionCondition}
      ${clientCondition}
      ${userAuthenticatedCondition}
      ${handledByN1agoCondition}
      ${objectiveProblemCondition}
      ${customerRequestTypeCondition}
  `);

  return { 
    conversations: conversationsResult.rows as any[], 
    total: Number((countResult.rows[0] as any).count) 
  };
}

export async function getUserConversationsWithMessages(userId: string) {
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
              'author_id', e.author_id,
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
}
