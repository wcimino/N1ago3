import { db, pool } from "../../../../db.js";
import { zendeskArticles, zendeskArticleEmbeddings, type ZendeskArticle, type ZendeskArticleEmbedding } from "../../../../../shared/schema.js";
import { eq, ilike, or, sql, desc, and, isNull, type SQL } from "drizzle-orm";
import { generateZendeskContentHash, stripHtmlTags } from "../../../../shared/embeddings/index.js";

export interface ArticleFilters {
  search?: string;
  sectionId?: string;
  locale?: string;
  helpCenterSubdomain?: string;
  helpCenterSubdomains?: string[];
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
      relevanceScore: sql<number>`LEAST(ROUND((
        COALESCE(
          ts_rank_cd(
            setweight(to_tsvector('portuguese', COALESCE(${zendeskArticles.title}, '')), 'A') ||
            setweight(to_tsvector('portuguese', COALESCE(${zendeskArticles.body}, '')), 'B'),
            plainto_tsquery('portuguese', ${normalizedSearch})
          ), 0
        ) * 10 +
        CASE WHEN LOWER(${zendeskArticles.title}) ILIKE ${'%' + firstTerm + '%'} THEN 5 ELSE 0 END +
        CASE WHEN ${zendeskArticles.promoted} = true THEN 2 ELSE 0 END +
        COALESCE(${zendeskArticles.voteSum}, 0) * 0.1 +
        CASE 
          WHEN ${zendeskArticles.zendeskUpdatedAt} > NOW() - INTERVAL '30 days' THEN 3
          WHEN ${zendeskArticles.zendeskUpdatedAt} > NOW() - INTERVAL '90 days' THEN 2
          WHEN ${zendeskArticles.zendeskUpdatedAt} > NOW() - INTERVAL '180 days' THEN 1
          ELSE 0
        END
      ) * 100.0 / 30.0), 100)`.as('relevance_score'),
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
  const { search, sectionId, locale, helpCenterSubdomain, helpCenterSubdomains, limit = 100, offset = 0 } = filters;
  
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
  
  if (helpCenterSubdomains && helpCenterSubdomains.length > 0) {
    const subdomainConditions = helpCenterSubdomains.map(sd => eq(zendeskArticles.helpCenterSubdomain, sd));
    const subdomainFilter = or(...subdomainConditions);
    if (subdomainFilter) {
      conditions.push(subdomainFilter);
    }
  } else if (helpCenterSubdomain) {
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

export function generateContentHash(article: {
  title: string;
  body: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
}): string {
  return generateZendeskContentHash(article);
}

export async function getArticlesPendingEmbedding(limit: number = 1): Promise<ZendeskArticle[]> {
  const results = await db.execute(sql`
    SELECT a.* 
    FROM zendesk_articles a
    LEFT JOIN zendesk_article_embeddings e ON a.id = e.article_id
    WHERE e.id IS NULL 
       OR e.content_hash != md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, ''))
    ORDER BY a.zendesk_updated_at DESC
    LIMIT ${limit}
  `);
  
  return results.rows as unknown as ZendeskArticle[];
}

export async function upsertEmbedding(params: {
  articleId: number;
  embedding: number[];
  modelUsed?: string;
  tokensUsed?: number;
  openaiLogId?: number;
}): Promise<void> {
  const embeddingString = `[${params.embedding.join(',')}]`;
  
  try {
    const result = await pool.query(`
      INSERT INTO zendesk_article_embeddings (article_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
      SELECT 
        $1,
        md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, '')),
        $2::vector,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      FROM zendesk_articles a
      WHERE a.id = $1
      ON CONFLICT (article_id) DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        embedding_vector = EXCLUDED.embedding_vector,
        model_used = EXCLUDED.model_used,
        tokens_used = EXCLUDED.tokens_used,
        openai_log_id = EXCLUDED.openai_log_id,
        updated_at = NOW()
      RETURNING id
    `, [
      params.articleId,
      embeddingString,
      params.modelUsed || 'text-embedding-3-small',
      params.tokensUsed || null,
      params.openaiLogId || null
    ]);
  } catch (error) {
    console.error(`[ZendeskArticles] Failed to upsert embedding for article ${params.articleId}:`, error);
    throw error;
  }
}

export async function getArticlesWithEmbedding(): Promise<Array<ZendeskArticle & { embeddingData: ZendeskArticleEmbedding }>> {
  const results = await db.execute(sql`
    SELECT 
      a.*,
      e.id as embedding_id,
      e.content_hash,
      e.model_used,
      e.tokens_used,
      e.openai_log_id,
      e.created_at as embedding_created_at,
      e.updated_at as embedding_updated_at
    FROM zendesk_articles a
    INNER JOIN zendesk_article_embeddings e ON a.id = e.article_id
  `);
  
  return results.rows as unknown as Array<ZendeskArticle & { embeddingData: ZendeskArticleEmbedding }>;
}

export async function getEmbeddingStats(): Promise<{
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  outdated: number;
}> {
  const [result] = await db.execute(sql`
    SELECT 
      (SELECT count(*)::int FROM zendesk_articles) as total,
      (SELECT count(*)::int FROM zendesk_article_embeddings) as with_embedding,
      (SELECT count(*)::int FROM zendesk_articles a LEFT JOIN zendesk_article_embeddings e ON a.id = e.article_id WHERE e.id IS NULL) as without_embedding,
      (SELECT count(*)::int FROM zendesk_articles a INNER JOIN zendesk_article_embeddings e ON a.id = e.article_id WHERE e.content_hash != md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, ''))) as outdated
  `).then(r => r.rows);
  
  const stats = result as any;
  return {
    total: stats?.total ?? 0,
    withEmbedding: stats?.with_embedding ?? 0,
    withoutEmbedding: stats?.without_embedding ?? 0,
    outdated: stats?.outdated ?? 0,
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
  options: { limit?: number; helpCenterSubdomain?: string; minSimilarity?: number } = {}
): Promise<SemanticSearchResult[]> {
  const { limit = 5, helpCenterSubdomain, minSimilarity = 60 } = options;
  
  const embeddingString = `[${queryEmbedding.join(',')}]`;
  
  const subdomainFilter = helpCenterSubdomain 
    ? sql`AND a.help_center_subdomain = ${helpCenterSubdomain}`
    : sql``;
  
  const results = await db.execute(sql`
    SELECT 
      a.id,
      a.zendesk_id as "zendeskId",
      a.title,
      a.body,
      a.section_name as "sectionName",
      a.category_name as "categoryName",
      a.html_url as "htmlUrl",
      ROUND((1 - (e.embedding_vector <=> ${embeddingString}::vector)) * 100) as similarity
    FROM zendesk_articles a
    INNER JOIN zendesk_article_embeddings e ON a.id = e.article_id
    WHERE e.embedding_vector IS NOT NULL
    ${subdomainFilter}
    ORDER BY e.embedding_vector <=> ${embeddingString}::vector
    LIMIT ${limit}
  `);
  
  return (results.rows as unknown as SemanticSearchResult[])
    .map(row => ({
      id: row.id,
      zendeskId: row.zendeskId,
      title: row.title,
      body: stripHtmlTags(row.body),
      sectionName: row.sectionName,
      categoryName: row.categoryName,
      htmlUrl: row.htmlUrl,
      similarity: Number(row.similarity),
    }))
    .filter(row => row.similarity >= minSimilarity);
}

export const ZendeskArticlesStorage = {
  getAllArticles,
  searchArticlesWithRelevance,
  getArticleById,
  getArticleByZendeskId,
  getDistinctSections,
  getDistinctSubdomains,
  getArticleCount,
  getArticlesPendingEmbedding,
  upsertEmbedding,
  getArticlesWithEmbedding,
  getEmbeddingStats,
  searchBySimilarity,
  generateContentHash,
};
