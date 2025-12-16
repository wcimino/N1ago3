import { db } from "../../../../db.js";
import { zendeskArticles } from "../../../../../shared/schema.js";
import { eq, ilike, or, sql, desc, and, type SQL } from "drizzle-orm";
import { stripHtmlTags } from "../../../../shared/embeddings/index.js";

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

export interface SemanticSearchResult {
  id: number;
  zendeskId: string;
  helpCenterSubdomain: string | null;
  title: string;
  body: string | null;
  sectionName: string | null;
  categoryName: string | null;
  htmlUrl: string | null;
  similarity: number;
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
      a.help_center_subdomain as "helpCenterSubdomain",
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
      helpCenterSubdomain: row.helpCenterSubdomain,
      title: row.title,
      body: stripHtmlTags(row.body),
      sectionName: row.sectionName,
      categoryName: row.categoryName,
      htmlUrl: row.htmlUrl,
      similarity: Number(row.similarity),
    }))
    .filter(row => row.similarity >= minSimilarity);
}
