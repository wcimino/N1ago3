import { db } from "../../../db.js";
import { conversationsSummary, conversations, eventsStandard } from "../../../../shared/schema.js";
import { eq, sql, gte, and, isNotNull } from "drizzle-orm";

export const classificationStorage = {
  async getConversationClassification(conversationId: number): Promise<{
    product: string | null;
    productStandard: string | null;
    subproduct: string | null;
    subject: string | null;
    intent: string | null;
    confidence: number | null;
  } | null> {
    const result = await db
      .select({
        product: conversationsSummary.product,
        productStandard: conversationsSummary.productStandard,
        subproduct: conversationsSummary.subproduct,
        subject: conversationsSummary.subject,
        intent: conversationsSummary.intent,
        confidence: conversationsSummary.confidence,
      })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);

    return result[0] || null;
  },

  async updateConversationClassification(
    conversationId: number, 
    data: { 
      product: string | null; 
      subproduct?: string | null;
      subject?: string | null;
      intent: string | null; 
      confidence: number | null 
    }
  ): Promise<void> {
    await db.update(conversationsSummary)
      .set({
        product: data.product,
        subproduct: data.subproduct ?? null,
        subject: data.subject ?? null,
        intent: data.intent,
        confidence: data.confidence,
        classifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId));
  },

  async getTopProductsByPeriod(
    period: "lastHour" | "last24Hours",
    limit: number = 5
  ): Promise<{ items: { product: string; count: number }[]; total: number }> {
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

    // Count distinct conversations (atendimentos) that had activity in the period grouped by product
    // Uses COALESCE(product_standard, product) to match /atendimentos page logic
    // - Shows product_standard if available, otherwise shows product
    // - "Sem classificação" only when neither product nor product_standard exists
    const productCaseExpr = sql<string>`COALESCE(${conversationsSummary.productStandard}, ${conversationsSummary.product}, 'Sem classificação')`;
    
    const results = await db
      .select({
        product: productCaseExpr,
        count: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .leftJoin(conversationsSummary, eq(conversations.id, conversationsSummary.conversationId))
      .where(gte(eventsStandard.occurredAt, since))
      .groupBy(productCaseExpr)
      .orderBy(sql`count(DISTINCT ${conversations.id}) desc`);

    return { 
      items: results as { product: string; count: number }[], 
      total: totalConversations || 0 
    };
  },

  async getUniqueProductsAndIntents(): Promise<{ products: string[]; productStandards: string[]; intents: string[] }> {
    const productsResult = await db
      .selectDistinct({ product: conversationsSummary.product })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.product));
    
    const productStandardsResult = await db
      .selectDistinct({ productStandard: conversationsSummary.productStandard })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.productStandard));
    
    const intentsResult = await db
      .selectDistinct({ intent: conversationsSummary.intent })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.intent));

    return {
      products: productsResult.map(r => r.product).filter((p): p is string => p !== null).sort(),
      productStandards: productStandardsResult.map(r => r.productStandard).filter((ps): ps is string => ps !== null).sort(),
      intents: intentsResult.map(r => r.intent).filter((i): i is string => i !== null).sort(),
    };
  },

  async getProductStandards(): Promise<Array<{ product: string; productStandard: string | null }>> {
    const results = await db
      .select({
        product: conversationsSummary.product,
        productStandard: sql<string | null>`MAX(${conversationsSummary.productStandard})`,
      })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.product))
      .groupBy(conversationsSummary.product)
      .orderBy(conversationsSummary.product);

    return results.filter(r => r.product !== null) as Array<{ product: string; productStandard: string | null }>;
  },

  async updateProductStandard(product: string, productStandard: string): Promise<number> {
    const result = await db
      .update(conversationsSummary)
      .set({ 
        productStandard,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.product, product));
    
    return result.rowCount ?? 0;
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

    // Count distinct conversations with identified problems grouped by problem name
    // The objectiveProblems field is a JSON array: [{ id, name, matchScore? }]
    const results = await db
      .select({
        problemName: sql<string>`problem_obj->>'name'`,
        count: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .innerJoin(conversationsSummary, eq(conversations.id, conversationsSummary.conversationId))
      .innerJoin(
        sql`jsonb_array_elements(${conversationsSummary.objectiveProblems}::jsonb) AS problem_obj`,
        sql`true`
      )
      .where(and(
        gte(eventsStandard.occurredAt, since),
        isNotNull(conversationsSummary.objectiveProblems)
      ))
      .groupBy(sql`problem_obj->>'name'`)
      .orderBy(sql`count(DISTINCT ${conversations.id}) desc`);

    // Calculate total distinct conversations with any problem identified
    const totalResult = results.reduce((sum, r) => sum + r.count, 0);
    const uniqueConversationsWithProblems = await db
      .select({
        total: sql<number>`count(DISTINCT ${conversations.id})::int`,
      })
      .from(eventsStandard)
      .innerJoin(conversations, eq(eventsStandard.conversationId, conversations.id))
      .innerJoin(conversationsSummary, eq(conversations.id, conversationsSummary.conversationId))
      .where(and(
        gte(eventsStandard.occurredAt, since),
        isNotNull(conversationsSummary.objectiveProblems),
        sql`jsonb_array_length(${conversationsSummary.objectiveProblems}::jsonb) > 0`
      ));

    return { 
      items: results as { problemName: string; count: number }[], 
      total: uniqueConversationsWithProblems[0]?.total || 0 
    };
  },
};
