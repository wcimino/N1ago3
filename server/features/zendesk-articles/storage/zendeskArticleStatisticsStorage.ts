import { db } from "../../../db.js";
import { zendeskArticleStatistics, zendeskArticles, type InsertZendeskArticleStatistic } from "../../../../shared/schema.js";
import { eq, sql, desc, and, gte, lte, type SQL } from "drizzle-orm";

export interface StatisticsFilters {
  zendeskArticleId?: number;
  conversationId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ArticleViewCount {
  zendeskArticleId: number;
  articleTitle: string | null;
  sectionName: string | null;
  viewCount: number;
}

export async function recordArticleView(data: InsertZendeskArticleStatistic): Promise<void> {
  await db.insert(zendeskArticleStatistics).values(data);
}

export async function recordMultipleArticleViews(
  articles: Array<{ id: number }>,
  context: { keywords?: string; sectionId?: string; conversationId?: number; externalConversationId?: string }
): Promise<void> {
  if (articles.length === 0) return;

  const records: InsertZendeskArticleStatistic[] = articles.map((article) => ({
    zendeskArticleId: article.id,
    keywords: context.keywords || null,
    sectionId: context.sectionId || null,
    conversationId: context.conversationId || null,
    externalConversationId: context.externalConversationId || null,
  }));

  await db.insert(zendeskArticleStatistics).values(records);
}

export async function getViewCountByArticle(filters: StatisticsFilters = {}): Promise<ArticleViewCount[]> {
  const { startDate, endDate, limit = 50, offset = 0 } = filters;
  
  const conditions: SQL[] = [];
  
  if (startDate) {
    conditions.push(gte(zendeskArticleStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(zendeskArticleStatistics.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const results = await db
    .select({
      zendeskArticleId: zendeskArticleStatistics.zendeskArticleId,
      articleTitle: zendeskArticles.title,
      sectionName: zendeskArticles.sectionName,
      viewCount: sql<number>`count(*)::int`,
    })
    .from(zendeskArticleStatistics)
    .leftJoin(zendeskArticles, eq(zendeskArticleStatistics.zendeskArticleId, zendeskArticles.id))
    .where(whereClause)
    .groupBy(zendeskArticleStatistics.zendeskArticleId, zendeskArticles.title, zendeskArticles.sectionName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .offset(offset);
  
  return results;
}

export async function getStatisticsForArticle(
  zendeskArticleId: number,
  filters: StatisticsFilters = {}
): Promise<{ totalViews: number; recentViews: typeof zendeskArticleStatistics.$inferSelect[] }> {
  const { startDate, endDate, limit = 20 } = filters;
  
  const conditions: SQL[] = [eq(zendeskArticleStatistics.zendeskArticleId, zendeskArticleId)];
  
  if (startDate) {
    conditions.push(gte(zendeskArticleStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(zendeskArticleStatistics.createdAt, endDate));
  }
  
  const whereClause = and(...conditions);
  
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(zendeskArticleStatistics)
    .where(whereClause);
  
  const recentViews = await db
    .select()
    .from(zendeskArticleStatistics)
    .where(whereClause)
    .orderBy(desc(zendeskArticleStatistics.createdAt))
    .limit(limit);
  
  return {
    totalViews: countResult?.count ?? 0,
    recentViews,
  };
}

export async function getTotalViewCount(filters: StatisticsFilters = {}): Promise<number> {
  const { startDate, endDate } = filters;
  
  const conditions: SQL[] = [];
  
  if (startDate) {
    conditions.push(gte(zendeskArticleStatistics.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(zendeskArticleStatistics.createdAt, endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(zendeskArticleStatistics)
    .where(whereClause);
  
  return result?.count ?? 0;
}

export const ZendeskArticleStatisticsStorage = {
  recordArticleView,
  recordMultipleArticleViews,
  getViewCountByArticle,
  getStatisticsForArticle,
  getTotalViewCount,
};
