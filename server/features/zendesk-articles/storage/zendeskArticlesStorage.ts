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

export interface SearchArticleResult {
  id: number;
  zendeskId: string;
  helpCenterSubdomain: string;
  title: string;
  body: string | null;
  sectionId: string | null;
  sectionName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  authorId: string | null;
  locale: string | null;
  htmlUrl: string | null;
  draft: boolean;
  promoted: boolean;
  position: number | null;
  voteSum: number | null;
  voteCount: number | null;
  labelNames: string[] | null;
  zendeskCreatedAt: Date | null;
  zendeskUpdatedAt: Date | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  relevanceScore: number;
  matchedSnippet?: string;
}

function normalizeForFts(search: string): string {
  return search
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length >= 2)
    .join(' ');
}

export async function searchArticlesWithRelevance(
  search: string,
  options: {
    sectionId?: string;
    locale?: string;
    helpCenterSubdomain?: string;
    limit?: number;
  } = {}
): Promise<SearchArticleResult[]> {
  const { sectionId, locale, helpCenterSubdomain, limit = 5 } = options;
  const normalizedSearch = normalizeForFts(search);
  
  if (!normalizedSearch.trim()) {
    return [];
  }
  
  const searchTerms = normalizedSearch.split(/\s+/).filter(t => t.length >= 2);
  
  const conditions: SQL[] = [];
  
  if (sectionId) {
    conditions.push(eq(zendeskArticles.sectionId, sectionId));
  }
  if (locale) {
    conditions.push(eq(zendeskArticles.locale, locale));
  }
  if (helpCenterSubdomain) {
    conditions.push(eq(zendeskArticles.helpCenterSubdomain, helpCenterSubdomain));
  }
  
  const likeConditions = searchTerms.slice(0, 3).flatMap(term => [
    ilike(zendeskArticles.title, `%${term}%`),
    ilike(zendeskArticles.body, `%${term}%`)
  ]).filter((c): c is SQL => c !== undefined);
  
  const ftsCondition = sql`(
    to_tsvector('portuguese', COALESCE(${zendeskArticles.title}, '') || ' ' || COALESCE(${zendeskArticles.body}, ''))
    @@ plainto_tsquery('portuguese', ${normalizedSearch})
    OR ${or(...likeConditions)}
  )`;
  conditions.push(ftsCondition);
  
  const whereClause = and(...conditions);
  
  const firstTerm = searchTerms[0] || '';
  
  const results = await db
    .select({
      id: zendeskArticles.id,
      zendeskId: zendeskArticles.zendeskId,
      helpCenterSubdomain: zendeskArticles.helpCenterSubdomain,
      title: zendeskArticles.title,
      body: zendeskArticles.body,
      sectionId: zendeskArticles.sectionId,
      sectionName: zendeskArticles.sectionName,
      categoryId: zendeskArticles.categoryId,
      categoryName: zendeskArticles.categoryName,
      authorId: zendeskArticles.authorId,
      locale: zendeskArticles.locale,
      htmlUrl: zendeskArticles.htmlUrl,
      draft: zendeskArticles.draft,
      promoted: zendeskArticles.promoted,
      position: zendeskArticles.position,
      voteSum: zendeskArticles.voteSum,
      voteCount: zendeskArticles.voteCount,
      labelNames: zendeskArticles.labelNames,
      zendeskCreatedAt: zendeskArticles.zendeskCreatedAt,
      zendeskUpdatedAt: zendeskArticles.zendeskUpdatedAt,
      syncedAt: zendeskArticles.syncedAt,
      createdAt: zendeskArticles.createdAt,
      updatedAt: zendeskArticles.updatedAt,
      relevanceScore: sql<number>`(
        COALESCE(
          ts_rank_cd(
            setweight(to_tsvector('portuguese', COALESCE(${zendeskArticles.title}, '')), 'A') ||
            setweight(to_tsvector('portuguese', COALESCE(${zendeskArticles.body}, '')), 'B'),
            plainto_tsquery('portuguese', ${normalizedSearch})
          ), 0
        ) * 10 +
        CASE WHEN LOWER(${zendeskArticles.title}) ILIKE ${'%' + firstTerm + '%'} THEN 5 ELSE 0 END +
        CASE WHEN ${zendeskArticles.promoted} = true THEN 2 ELSE 0 END +
        COALESCE(${zendeskArticles.voteSum}, 0) * 0.1
      )`.as('relevance_score'),
    })
    .from(zendeskArticles)
    .where(whereClause)
    .orderBy(sql`relevance_score DESC`, desc(zendeskArticles.zendeskUpdatedAt))
    .limit(limit);
  
  return results.map(r => ({
    ...r,
    relevanceScore: Number(r.relevanceScore) || 0,
  }));
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

export async function getArticlesWithoutEmbedding(limit: number = 100): Promise<ZendeskArticle[]> {
  return db
    .select()
    .from(zendeskArticles)
    .where(sql`${zendeskArticles.embedding} IS NULL`)
    .orderBy(desc(zendeskArticles.zendeskUpdatedAt))
    .limit(limit);
}

export async function updateEmbedding(id: number, embedding: string): Promise<void> {
  await db.execute(sql`
    UPDATE zendesk_articles 
    SET 
      embedding = ${embedding},
      embedding_vector = ${embedding}::vector,
      embedding_updated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}
  `);
}

export async function getArticlesWithEmbedding(): Promise<Array<ZendeskArticle & { embedding: string }>> {
  const results = await db
    .select()
    .from(zendeskArticles)
    .where(sql`${zendeskArticles.embedding} IS NOT NULL`);
  
  return results.filter((r): r is ZendeskArticle & { embedding: string } => 
    r.embedding !== null
  );
}

export async function getEmbeddingStats(): Promise<{
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
}> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withEmbedding: sql<number>`count(CASE WHEN ${zendeskArticles.embedding} IS NOT NULL THEN 1 END)::int`,
      withoutEmbedding: sql<number>`count(CASE WHEN ${zendeskArticles.embedding} IS NULL THEN 1 END)::int`,
    })
    .from(zendeskArticles);
  
  return {
    total: result?.total ?? 0,
    withEmbedding: result?.withEmbedding ?? 0,
    withoutEmbedding: result?.withoutEmbedding ?? 0,
  };
}

export interface SemanticSearchResult {
  id: number;
  zendeskId: string;
  title: string;
  body: string | null;
  sectionName: string | null;
  categoryName: string | null;
  htmlUrl: string | null;
  similarity: number;
}

export async function searchBySimilarity(
  queryEmbedding: number[],
  options: { limit?: number } = {}
): Promise<SemanticSearchResult[]> {
  const { limit = 5 } = options;
  
  const embeddingString = `[${queryEmbedding.join(',')}]`;
  
  const results = await db.execute(sql`
    SELECT 
      id,
      zendesk_id as "zendeskId",
      title,
      body,
      section_name as "sectionName",
      category_name as "categoryName",
      html_url as "htmlUrl",
      ROUND((1 - (embedding_vector <=> ${embeddingString}::vector)) * 100) as similarity
    FROM zendesk_articles
    WHERE embedding_vector IS NOT NULL
    ORDER BY embedding_vector <=> ${embeddingString}::vector
    LIMIT ${limit}
  `);
  
  return (results.rows as unknown as SemanticSearchResult[]).map(row => ({
    id: row.id,
    zendeskId: row.zendeskId,
    title: row.title,
    body: row.body,
    sectionName: row.sectionName,
    categoryName: row.categoryName,
    htmlUrl: row.htmlUrl,
    similarity: Number(row.similarity),
  }));
}

export const ZendeskArticlesStorage = {
  getAllArticles,
  searchArticlesWithRelevance,
  getArticleById,
  getArticleByZendeskId,
  getDistinctSections,
  getDistinctSubdomains,
  getArticleCount,
  getArticlesWithoutEmbedding,
  updateEmbedding,
  getArticlesWithEmbedding,
  getEmbeddingStats,
  searchBySimilarity,
};
