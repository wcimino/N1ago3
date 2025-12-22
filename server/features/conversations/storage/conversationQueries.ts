import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { buildFiltersForConversationList } from "./conversationFilters.js";

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
    SELECT 
      c.id,
      c.external_conversation_id,
      c.user_id,
      c.status,
      TO_CHAR(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      TO_CHAR(
        COALESCE(
          (SELECT MAX(occurred_at) FROM events_standard e WHERE e.conversation_id = c.id AND e.event_type = 'message'),
          c.created_at
        ), 
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as updated_at,
      TO_CHAR(c.closed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as closed_at,
      c.closed_reason,
      c.current_handler,
      c.current_handler_name,
      COALESCE(
        (SELECT COUNT(*) FROM events_standard e WHERE e.conversation_id = c.id AND e.event_type = 'message'),
        0
      ) as message_count,
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

export async function getUserConversationsWithMessagesOptimized(userId: string) {
  const result = await db.execute(sql`
    WITH user_conversations AS (
      SELECT id FROM conversations WHERE user_id = ${userId}
    ),
    conversation_messages AS (
      SELECT 
        e.conversation_id,
        JSON_AGG(
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
          ) ORDER BY e.occurred_at
        ) as messages
      FROM events_standard e
      WHERE e.event_type = 'message' AND e.conversation_id IN (SELECT id FROM user_conversations)
      GROUP BY e.conversation_id
    ),
    first_case_demand AS (
      SELECT DISTINCT ON (conversation_id)
        conversation_id,
        status,
        interaction_count,
        articles_and_objective_problems,
        solution_center_articles_and_problems,
        solution_center_article_and_problems_id_selected
      FROM case_demand
      WHERE conversation_id IN (SELECT id FROM user_conversations)
      ORDER BY conversation_id, id
    )
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
      COALESCE(cm.messages, '[]'::json) as messages,
      cs.id as summary_id,
      cs.summary as summary_text,
      TO_CHAR(cs.generated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as summary_generated_at,
      TO_CHAR(cs.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as summary_updated_at,
      cs.product_id,
      cs.product_confidence,
      cs.product_confidence_reason,
      TO_CHAR(cs.classified_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as classified_at,
      cs.client_request,
      cs.client_request_versions,
      cs.agent_actions,
      cs.current_status,
      cs.important_info,
      cs.customer_emotion_level,
      cs.customer_request_type,
      cs.customer_request_type_confidence,
      cs.customer_request_type_reason,
      cs.objective_problems,
      cs.orchestrator_status,
      cs.conversation_orchestrator_log,
      pc.produto as product_name,
      pc.subproduto as subproduct_name,
      fcd.status as demand_finder_status,
      fcd.interaction_count as demand_finder_interaction_count,
      fcd.articles_and_objective_problems,
      fcd.solution_center_articles_and_problems,
      fcd.solution_center_article_and_problems_id_selected
    FROM conversations c
    LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
    LEFT JOIN conversations_summary cs ON cs.conversation_id = c.id
    LEFT JOIN products_catalog pc ON pc.id = cs.product_id
    LEFT JOIN first_case_demand fcd ON fcd.conversation_id = c.id
    WHERE c.user_id = ${userId}
    ORDER BY c.created_at
  `);

  if (result.rows.length === 0) return null;

  return result.rows;
}

export async function getSuggestedResponsesBatch(conversationIds: number[]) {
  if (conversationIds.length === 0) return [];
  
  const idPlaceholders = sql.join(conversationIds.map(id => sql`${id}`), sql`, `);
  
  const result = await db.execute(sql`
    SELECT 
      conversation_id,
      suggested_response,
      TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      last_event_id,
      status,
      articles_used
    FROM responses_suggested
    WHERE conversation_id IN (${idPlaceholders})
    ORDER BY conversation_id, created_at
  `);
  
  return result.rows;
}
