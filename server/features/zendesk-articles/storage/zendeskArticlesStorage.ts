import { db } from "../../../db.js";
import { zendeskArticles, type ZendeskArticle } from "../../../../shared/schema.js";
import { eq, ilike, or, sql, desc, and, type SQL } from "drizzle-orm";

export interface ArticleFilters {
  search?: string;
  sectionId?: string;
  locale?: string;
  helpCenterSubdomain?: string;
  limit?: number;
  offset?: number;
}

export async function getAllArticles(filters: ArticleFilters = {}): Promise<ZendeskArticle[]> {
  const { search, sectionId, locale, helpCenterSubdomain, limit = 100, offset = 0 } = filters;
  
  const conditions: SQL[] = [];
  
  if (search) {
    const searchCondition = or(
      ilike(zendeskArticles.title, `%${search}%`),
      ilike(zendeskArticles.body, `%${search}%`)
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  
  if (sectionId) {
    conditions.push(eq(zendeskArticles.sectionId, sectionId));
  }
  
  if (locale) {
    conditions.push(eq(zendeskArticles.locale, locale));
  }
  
  if (helpCenterSubdomain) {
    conditions.push(eq(zendeskArticles.helpCenterSubdomain, helpCenterSubdomain));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  return db
    .select()
    .from(zendeskArticles)
    .where(whereClause)
    .orderBy(desc(zendeskArticles.zendeskUpdatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getArticleById(id: number): Promise<ZendeskArticle | null> {
  const [article] = await db
    .select()
    .from(zendeskArticles)
    .where(eq(zendeskArticles.id, id))
    .limit(1);
  
  return article ?? null;
}

export async function getArticleByZendeskId(zendeskId: string): Promise<ZendeskArticle | null> {
  const [article] = await db
    .select()
    .from(zendeskArticles)
    .where(eq(zendeskArticles.zendeskId, zendeskId))
    .limit(1);
  
  return article ?? null;
}

export async function getDistinctSections(): Promise<Array<{ sectionId: string; sectionName: string | null; count: number }>> {
  const results = await db
    .select({
      sectionId: zendeskArticles.sectionId,
      sectionName: zendeskArticles.sectionName,
      count: sql<number>`count(*)::int`,
    })
    .from(zendeskArticles)
    .groupBy(zendeskArticles.sectionId, zendeskArticles.sectionName)
    .orderBy(zendeskArticles.sectionName);
  
  return results.filter((r): r is { sectionId: string; sectionName: string | null; count: number } => 
    r.sectionId !== null
  );
}

export async function getArticleCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(zendeskArticles);
  
  return result?.count ?? 0;
}

export async function getDistinctSubdomains(): Promise<Array<{ subdomain: string; count: number }>> {
  const results = await db
    .select({
      subdomain: zendeskArticles.helpCenterSubdomain,
      count: sql<number>`count(*)::int`,
    })
    .from(zendeskArticles)
    .groupBy(zendeskArticles.helpCenterSubdomain)
    .orderBy(zendeskArticles.helpCenterSubdomain);
  
  return results.filter((r): r is { subdomain: string; count: number } => 
    r.subdomain !== null
  );
}

export const ZendeskArticlesStorage = {
  getAllArticles,
  getArticleById,
  getArticleByZendeskId,
  getDistinctSections,
  getDistinctSubdomains,
  getArticleCount,
};
