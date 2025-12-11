import { db } from "../../../db.js";
import { knowledgeBaseStatistics, knowledgeBase, type InsertKnowledgeBaseStatistic } from "../../../../shared/schema.js";
import { eq, sql, desc, and, gte, lte, type SQL } from "drizzle-orm";

export interface StatisticsFilters {
  articleId?: number;
  conversationId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ArticleViewCount {
  articleId: number;
  intentId: number | null;
  viewCount: number;
}

export async function recordArticleView(data: InsertKnowledgeBaseStatistic): Promise<void> {
  await db.insert(knowledgeBaseStatistics).values(data);
}

export async function recordMultipleArticleViews(
  articles: Array<{ id: number }>,
  context: { keywords?: string; conversationId?: number; externalConversationId?: string }
): Promise<void> {
  if (articles.length === 0) return;

  const records: InsertKnowledgeBaseStatistic[] = articles.map((article) => ({
    articleId: article.id,
    keywords: context.keywords || null,
    conversationId: context.conversationId || null,
    externalConversationId: context.externalConversationId || null,
  }));

  await db.insert(knowledgeBaseStatistics).values(records);
}

export async function getViewCountByArticle(filters: StatisticsFilters = {}): Promise<ArticleViewCount[]> {
  const { startDate, endDate, limit = 1000, offset = 0 } = filters;
  
  const conditions: SQL[] = [];
  
  if (startDate) {
    conditions.push(gte(knowledgeBaseStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(knowledgeBaseStatistics.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const results = await db
    .select({
      articleId: knowledgeBaseStatistics.articleId,
      intentId: knowledgeBase.intentId,
      viewCount: sql<number>`count(*)::int`,
    })
    .from(knowledgeBaseStatistics)
    .leftJoin(knowledgeBase, eq(knowledgeBaseStatistics.articleId, knowledgeBase.id))
    .where(whereClause)
    .groupBy(knowledgeBaseStatistics.articleId, knowledgeBase.intentId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .offset(offset);
  
  return results;
}

export async function getViewCountByIntent(filters: StatisticsFilters = {}): Promise<Map<number, number>> {
  const { startDate, endDate } = filters;
  
  const conditions: SQL[] = [];
  
  if (startDate) {
    conditions.push(gte(knowledgeBaseStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(knowledgeBaseStatistics.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const results = await db
    .select({
      intentId: knowledgeBase.intentId,
      viewCount: sql<number>`count(*)::int`,
    })
    .from(knowledgeBaseStatistics)
    .innerJoin(knowledgeBase, eq(knowledgeBaseStatistics.articleId, knowledgeBase.id))
    .where(whereClause)
    .groupBy(knowledgeBase.intentId);
  
  const intentViewMap = new Map<number, number>();
  for (const result of results) {
    if (result.intentId !== null) {
      intentViewMap.set(result.intentId, result.viewCount);
    }
  }
  
  return intentViewMap;
}

export async function getTotalViewCount(filters: StatisticsFilters = {}): Promise<number> {
  const { startDate, endDate } = filters;
  
  const conditions: SQL[] = [];
  
  if (startDate) {
    conditions.push(gte(knowledgeBaseStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(knowledgeBaseStatistics.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeBaseStatistics)
    .where(whereClause);
  
  return result?.count ?? 0;
}

export const KnowledgeBaseStatisticsStorage = {
  recordArticleView,
  recordMultipleArticleViews,
  getViewCountByArticle,
  getViewCountByIntent,
  getTotalViewCount,
};
