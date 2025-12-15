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

    // Get total distinct conversations (atendimentos) that had activity in the period
    const [{ totalConversations }] = await db
      .select({
        totalConversations: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .where(gte(eventsStandard.occurredAt, since));

    // Count distinct conversations (atendimentos) that had activity in the period grouped by productId
    // Groups by product_id for precise filtering, uses products_catalog for product name display
    const results = await db
      .select({
        productId: conversationsSummary.productId,
        product: sql<string>`COALESCE(${productsCatalog.produto}, 'Sem classificação')`,
        count: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .leftJoin(conversationsSummary, eq(conversations.id, conversationsSummary.conversationId))
      .leftJoin(productsCatalog, eq(conversationsSummary.productId, productsCatalog.id))
      .where(gte(eventsStandard.occurredAt, since))
      .groupBy(conversationsSummary.productId, sql`COALESCE(${productsCatalog.produto}, 'Sem classificação')`)
      .orderBy(sql`count(DISTINCT ${conversations.id}) desc`);

    return { 
      items: results.map(r => ({
        product: r.product || 'Sem classificação',
        productId: r.productId,
        count: r.count,
      })), 
      total: totalConversations || 0 
    };
  },

  async getUniqueProductsAndRequestTypes(): Promise<{ productIds: number[]; customerRequestTypes: string[]; objectiveProblems: string[] }> {
    const productIdsResult = await db
      .selectDistinct({ productId: conversationsSummary.productId })
      .from(conversationsSummary)
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

    return {
      productIds: productIdsResult.map(r => r.productId).filter((p): p is number => p !== null).sort((a, b) => a - b),
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

    // Get total distinct conversations (atendimentos) that had activity in the period
    const [{ totalConversations }] = await db
      .select({
        totalConversations: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .where(gte(eventsStandard.occurredAt, since));

    // Count distinct conversations (atendimentos) that had activity in the period grouped by emotion level (0 = without classification)
    const results = await db
      .select({
        emotionLevel: sql<number>`COALESCE(${conversationsSummary.customerEmotionLevel}, 0)`,
        count: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .leftJoin(conversationsSummary, eq(conversations.id, conversationsSummary.conversationId))
      .where(gte(eventsStandard.occurredAt, since))
      .groupBy(sql`COALESCE(${conversationsSummary.customerEmotionLevel}, 0)`)
      .orderBy(sql`COALESCE(${conversationsSummary.customerEmotionLevel}, 0)`);

    return { 
      items: results as { emotionLevel: number; count: number }[], 
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

    // First get the distinct conversation IDs with activity in the period
    // Then count problems grouped by name
    const results = await db.execute<{ problem_name: string; count: number }>(sql`
      WITH active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${eventsStandard} e
        INNER JOIN ${conversations} c ON e.conversation_id = c.id
        WHERE e.occurred_at >= ${since}
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

    // Get total distinct conversations with any problem
    const totalResult = await db.execute<{ total: number }>(sql`
      WITH active_conversations AS (
        SELECT DISTINCT c.id as conversation_id
        FROM ${eventsStandard} e
        INNER JOIN ${conversations} c ON e.conversation_id = c.id
        WHERE e.occurred_at >= ${since}
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
