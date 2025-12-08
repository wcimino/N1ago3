import { db } from "../../../db.js";
import { conversationsSummary, conversations } from "../../../../shared/schema.js";
import { eq, sql, gte, and, isNotNull } from "drizzle-orm";

export const classificationStorage = {
  async getConversationClassification(conversationId: number): Promise<{
    product: string | null;
    productStandard: string | null;
    intent: string | null;
    confidence: number | null;
  } | null> {
    const result = await db
      .select({
        product: conversationsSummary.product,
        productStandard: conversationsSummary.productStandard,
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
    data: { product: string | null; intent: string | null; confidence: number | null }
  ): Promise<void> {
    await db.update(conversationsSummary)
      .set({
        product: data.product,
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
  ): Promise<{ product: string; count: number }[]> {
    const now = new Date();
    let since: Date;

    if (period === "lastHour") {
      since = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const results = await db
      .select({
        product: conversationsSummary.productStandard,
        count: sql<number>`count(*)::int`,
      })
      .from(conversationsSummary)
      .innerJoin(conversations, eq(conversationsSummary.conversationId, conversations.id))
      .where(
        and(
          isNotNull(conversationsSummary.productStandard),
          gte(conversations.updatedAt, since)
        )
      )
      .groupBy(conversationsSummary.productStandard)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return results.filter(r => r.product !== null) as { product: string; count: number }[];
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
};
