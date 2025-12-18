import { db } from "../../../db.js";
import { conversationsSummary, conversations, eventsStandard, productsCatalog } from "../../../../shared/schema.js";
import { eq, sql, gte, and, isNotNull } from "drizzle-orm";

export const classificationStorage = {
  async getConversationClassification(conversationId: number): Promise<{
    productId: number | null;
    productConfidence: number | null;
    productConfidenceReason: string | null;
    customerRequestType: string | null;
    customerRequestTypeConfidence: number | null;
    customerRequestTypeReason: string | null;
  } | null> {
    const result = await db
      .select({
        productId: conversationsSummary.productId,
        productConfidence: conversationsSummary.productConfidence,
        productConfidenceReason: conversationsSummary.productConfidenceReason,
        customerRequestType: conversationsSummary.customerRequestType,
        customerRequestTypeConfidence: conversationsSummary.customerRequestTypeConfidence,
        customerRequestTypeReason: conversationsSummary.customerRequestTypeReason,
      })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);

    return result[0] || null;
  },

  async updateConversationClassification(
    conversationId: number, 
    data: { 
      productId: number | null; 
      productConfidence?: number | null;
      productConfidenceReason?: string | null;
      customerRequestType?: string | null;
      customerRequestTypeConfidence?: number | null;
      customerRequestTypeReason?: string | null;
    }
  ): Promise<void> {
    await db.update(conversationsSummary)
      .set({
        productId: data.productId,
        productConfidence: data.productConfidence ?? null,
        productConfidenceReason: data.productConfidenceReason ?? null,
        customerRequestType: data.customerRequestType ?? null,
        customerRequestTypeConfidence: data.customerRequestTypeConfidence ?? null,
        customerRequestTypeReason: data.customerRequestTypeReason ?? null,
        classifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId));
  },

  async getTopProductsByPeriod(
    period: "lastHour" | "last24Hours",
    limit: number = 5
  ): Promise<{ items: { product: string; productId: number | null; count: number }[]; total: number }> {
    const now = new Date();
    let since: Date;

    if (period === "lastHour") {
      since = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Filter only conversations with more than 2 messages (counting only actual messages, not system events)
    const minMessages = 2;

    // Get total and grouped stats in a single query for efficiency
    // Only count event_type = 'message' for actual messages
    const results = await db.execute<{ product_id: number | null; product: string; count: number }>(sql`
      WITH conversation_message_counts AS (
        SELECT conversation_id, COUNT(*)::int as msg_count
        FROM ${eventsStandard}
        WHERE event_type = 'message' AND occurred_at >= ${since}
        GROUP BY conversation_id
        HAVING COUNT(*) > ${minMessages}
      ),
      active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${conversations} c
        INNER JOIN conversation_message_counts cmc ON c.id = cmc.conversation_id
      )
      SELECT 
        cs.product_id,
        COALESCE(pc.produto, 'Sem classificação') as product,
        COUNT(DISTINCT ac.conversation_id)::int as count
      FROM active_conversations ac
      LEFT JOIN ${conversationsSummary} cs ON ac.conversation_id = cs.conversation_id
      LEFT JOIN ${productsCatalog} pc ON cs.product_id = pc.id
      GROUP BY cs.product_id, COALESCE(pc.produto, 'Sem classificação')
      ORDER BY count DESC
    `);

    // Calculate total from all items
    const totalConversations = results.rows.reduce((sum, r) => sum + r.count, 0);

    return { 
      items: results.rows.map(r => ({
        product: r.product || 'Sem classificação',
        productId: r.product_id,
        count: r.count,
      })), 
      total: totalConversations || 0 
    };
  },

  async getUniqueProductsAndRequestTypes(): Promise<{ productStandards: string[]; intents: string[]; customerRequestTypes: string[]; objectiveProblems: string[] }> {
    const productStandardsResult = await db
      .selectDistinct({ produto: productsCatalog.produto })
      .from(conversationsSummary)
      .innerJoin(productsCatalog, eq(conversationsSummary.productId, productsCatalog.id))
      .where(isNotNull(conversationsSummary.productId));
    
    const customerRequestTypesResult = await db
      .selectDistinct({ customerRequestType: conversationsSummary.customerRequestType })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.customerRequestType));

    const objectiveProblemsResult = await db.execute(sql`
      SELECT DISTINCT jsonb_array_elements(objective_problems::jsonb)->>'name' as problem_name
      FROM conversations_summary
      WHERE objective_problems IS NOT NULL 
        AND jsonb_typeof(objective_problems::jsonb) = 'array'
        AND jsonb_array_length(objective_problems::jsonb) > 0
      ORDER BY problem_name
    `);

    const productNames = productStandardsResult.map(r => r.produto).filter((p): p is string => p !== null).sort();
    const productStandards = ['Sem classificação', ...productNames];
    
    return {
      productStandards,
      intents: [],
      customerRequestTypes: customerRequestTypesResult.map(r => r.customerRequestType).filter((i): i is string => i !== null).sort(),
      objectiveProblems: (objectiveProblemsResult.rows as any[]).map(r => r.problem_name).filter((p): p is string => p !== null),
    };
  },

  async getEmotionStatsByPeriod(
    period: "lastHour" | "last24Hours"
  ): Promise<{ items: { emotionLevel: number; count: number }[]; total: number }> {
    const now = new Date();
    let since: Date;

    if (period === "lastHour") {
      since = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Filter only conversations with more than 2 messages (counting only actual messages, not system events)
    const minMessages = 2;

    // Count distinct conversations grouped by emotion level (0 = without classification)
    // Only include conversations with more than 2 actual messages in the period
    const results = await db.execute<{ emotion_level: number; count: number }>(sql`
      WITH conversation_message_counts AS (
        SELECT conversation_id, COUNT(*)::int as msg_count
        FROM ${eventsStandard}
        WHERE event_type = 'message' AND occurred_at >= ${since}
        GROUP BY conversation_id
        HAVING COUNT(*) > ${minMessages}
      ),
      active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${conversations} c
        INNER JOIN conversation_message_counts cmc ON c.id = cmc.conversation_id
      )
      SELECT 
        COALESCE(cs.customer_emotion_level, 0) as emotion_level,
        COUNT(DISTINCT ac.conversation_id)::int as count
      FROM active_conversations ac
      LEFT JOIN ${conversationsSummary} cs ON ac.conversation_id = cs.conversation_id
      GROUP BY COALESCE(cs.customer_emotion_level, 0)
      ORDER BY emotion_level
    `);

    // Calculate total from all items
    const totalConversations = results.rows.reduce((sum, r) => sum + r.count, 0);

    return { 
      items: results.rows.map(r => ({ emotionLevel: r.emotion_level, count: r.count })), 
      total: totalConversations || 0 
    };
  },

  async getObjectiveProblemStatsByPeriod(
    period: "lastHour" | "last24Hours"
  ): Promise<{ items: { problemName: string; count: number }[]; total: number }> {
    const now = new Date();
    let since: Date;

    if (period === "lastHour") {
      since = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Filter only conversations with more than 2 messages (counting only actual messages, not system events)
    const minMessages = 2;

    // Get distinct conversation IDs with activity in the period that have problems
    // Only include conversations with more than 2 actual messages
    const results = await db.execute<{ problem_name: string; count: number }>(sql`
      WITH conversation_message_counts AS (
        SELECT conversation_id, COUNT(*)::int as msg_count
        FROM ${eventsStandard}
        WHERE event_type = 'message' AND occurred_at >= ${since}
        GROUP BY conversation_id
        HAVING COUNT(*) > ${minMessages}
      ),
      active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${conversations} c
        INNER JOIN conversation_message_counts cmc ON c.id = cmc.conversation_id
      ),
      conversations_with_problems AS (
        SELECT 
          ac.conversation_id,
          cs.objective_problems
        FROM active_conversations ac
        INNER JOIN ${conversationsSummary} cs ON ac.conversation_id = cs.conversation_id
        WHERE cs.objective_problems IS NOT NULL
          AND jsonb_array_length(cs.objective_problems::jsonb) > 0
      )
      SELECT 
        problem_obj->>'name' as problem_name,
        COUNT(DISTINCT cwp.conversation_id)::int as count
      FROM conversations_with_problems cwp
      CROSS JOIN LATERAL jsonb_array_elements(cwp.objective_problems::jsonb) AS problem_obj
      GROUP BY problem_obj->>'name'
      ORDER BY count DESC
    `);

    // Get total distinct conversations with any problem from the same CTE results
    const totalResult = await db.execute<{ total: number }>(sql`
      WITH conversation_message_counts AS (
        SELECT conversation_id, COUNT(*)::int as msg_count
        FROM ${eventsStandard}
        WHERE event_type = 'message' AND occurred_at >= ${since}
        GROUP BY conversation_id
        HAVING COUNT(*) > ${minMessages}
      ),
      active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${conversations} c
        INNER JOIN conversation_message_counts cmc ON c.id = cmc.conversation_id
      )
      SELECT COUNT(DISTINCT ac.conversation_id)::int as total
      FROM active_conversations ac
      INNER JOIN ${conversationsSummary} cs ON ac.conversation_id = cs.conversation_id
      WHERE cs.objective_problems IS NOT NULL
        AND jsonb_array_length(cs.objective_problems::jsonb) > 0
    `);

    return { 
      items: results.rows.map(r => ({ problemName: r.problem_name, count: r.count })), 
      total: totalResult.rows[0]?.total || 0 
    };
  },
};
