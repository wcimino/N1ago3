import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding } from "../../../shared/embeddings/index.js";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";
import { normalizeText, calculateMatchScore as sharedCalculateMatchScore, parseSearchTerms, type MatchField } from "../../../shared/utils/matchScoring.js";

export interface KBSearchParams {
  productId?: number;
  keywords?: string | string[];
  conversationContext?: string;
  limit?: number;
}

export interface KBSearchContext {
  conversationId?: number;
  externalConversationId?: string;
}

export interface KBArticleResult {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  intentId: number | null;
  description: string;
  resolution: string;
  observations: string | null;
  relevanceScore: number;
  matchReason?: string;
}

export interface KBSearchResult {
  articles: KBArticleResult[];
  productId: number | null;
}

function calculateArticleMatchScore(
  article: KnowledgeBaseArticle,
  searchTerms: string[]
): { score: number; reason: string } {
  const fields: MatchField[] = [
    { name: "Nome", value: article.name || "", weight: 'contains_name' },
    { name: "Descrição", value: article.description || "", weight: 'contains_secondary' },
    { name: "Resolução", value: article.resolution || "", weight: 'contains_tertiary' },
    { name: "Observações", value: article.observations || "", weight: 'contains_low' },
    { name: "Produto", value: article.productStandard || "", weight: 'contains_low' },
    { name: "Subproduto", value: article.subproductStandard || "", weight: 'contains_low' },
  ];

  const result = sharedCalculateMatchScore(fields, searchTerms);
  return { score: result.score, reason: result.reason };
}

function applyKeywordsBoost(
  articles: KBArticleResult[],
  keywordsStr: string,
  limit: number
): KBArticleResult[] {
  const searchTerms = keywordsStr
    .split(/\s+/)
    .filter(t => t.length >= 2);

  if (searchTerms.length === 0) {
    return articles.slice(0, limit);
  }

  // Apply keyword matching as boost to existing semantic scores
  const boostedArticles = articles.map(article => {
    // Normalize article content to match normalized keywords (accent-insensitive)
    const articleContent = normalizeText([
      article.name || "",
      article.description,
      article.resolution,
      article.observations || "",
      article.productStandard,
      article.subproductStandard || ""
    ].join(" "));

    let keywordBoost = 0;
    const matchedKeywords: string[] = [];

    for (const term of searchTerms) {
      const normalizedTerm = normalizeText(term);
      if (articleContent.includes(normalizedTerm)) {
        keywordBoost += 5; // +5% boost per matched keyword
        matchedKeywords.push(term);
      }
    }

    const boostedScore = Math.min(100, article.relevanceScore + keywordBoost);
    const matchReason = matchedKeywords.length > 0
      ? `${article.matchReason} + keywords: ${matchedKeywords.join(", ")}`
      : article.matchReason;

    return {
      ...article,
      relevanceScore: boostedScore,
      matchReason
    };
  });

  // Re-sort by boosted score and limit
  return boostedArticles
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  const { productId, conversationContext, limit = 5 } = params;

  if (productId) {
    console.log(`[KB Search] Using productId=${productId}`);
  }

  const keywordsStr = Array.isArray(params.keywords) 
    ? params.keywords.join(" ") 
    : params.keywords || "";

  let articles: KBArticleResult[] = [];
  const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();

  // Hybrid approach: conversationContext for main semantic search, keywords for boost/filter
  if (conversationContext && conversationContext.trim().length > 0 && hasEmbeddings) {
    try {
      // Use conversation context as the main semantic search
      console.log(`[KB Search] Hybrid search: using conversationContext for embedding, productId=${productId || 'none'}`);
      
      const { embedding: contextEmbedding } = await generateEmbedding(conversationContext, { contextType: "query" });
      const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
        contextEmbedding,
        { productId, limit: keywordsStr ? limit * 2 : limit } // Get more if we'll filter by keywords
      );
      
      articles = semanticResults.map(a => ({
        id: a.id,
        name: a.name,
        productStandard: a.productStandard,
        subproductStandard: a.subproductStandard,
        intentId: a.intentId,
        description: a.description,
        resolution: a.resolution,
        observations: a.observations,
        relevanceScore: Math.round(a.similarity * 100),
        matchReason: `Similaridade semântica (contexto): ${Math.round(a.similarity * 100)}%`
      }));
      
      console.log(`[KB Search] Context-based semantic search found ${articles.length} articles`);

      // Apply keywords as boost/filter if provided
      if (keywordsStr && keywordsStr.trim().length > 0) {
        articles = applyKeywordsBoost(articles, keywordsStr, limit);
        console.log(`[KB Search] After keywords boost/filter: ${articles.length} articles`);
      }
    } catch (error) {
      console.error("[KB Search] Hybrid search failed, falling back to keywords-only search:", error);
      if (keywordsStr) {
        articles = await runTextBasedSearch(keywordsStr, productId, limit);
      }
    }
  } else if (keywordsStr && keywordsStr.trim().length > 0) {
    // Fallback: use keywords for semantic/text search (original behavior)
    if (hasEmbeddings) {
      try {
        console.log(`[KB Search] Semantic search (keywords): productId=${productId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
        
        const { embedding: queryEmbedding } = await generateEmbedding(keywordsStr, { contextType: "query" });
        const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
          queryEmbedding,
          { productId, limit }
        );
        
        articles = semanticResults.map(a => ({
          id: a.id,
          name: a.name,
          productStandard: a.productStandard,
          subproductStandard: a.subproductStandard,
          intentId: a.intentId,
          description: a.description,
          resolution: a.resolution,
          observations: a.observations,
          relevanceScore: Math.round(a.similarity * 100),
          matchReason: `Similaridade semântica: ${Math.round(a.similarity * 100)}%`
        }));
        
        console.log(`[KB Search] Semantic search found ${articles.length} articles`);
      } catch (error) {
        console.error("[KB Search] Semantic search failed, falling back to text search:", error);
        articles = await runTextBasedSearch(keywordsStr, productId, limit);
      }
    } else {
      console.log(`[KB Search] No embeddings available, using text search: productId=${productId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
      articles = await runTextBasedSearch(keywordsStr, productId, limit);
    }
  } else if (productId) {
    console.log(`[KB Search] No keywords or context, filtering by productId: ${productId}`);
    const allArticles = await knowledgeBaseStorage.getAllArticles({
      productId,
      limit
    });
    articles = allArticles.map(a => ({
      id: a.id,
      name: a.name,
      productStandard: a.productStandard,
      subproductStandard: a.subproductStandard,
      intentId: a.intentId,
      description: a.description,
      resolution: a.resolution,
      observations: a.observations,
      relevanceScore: 0,
      matchReason: "Listagem por produto"
    }));
    console.log(`[KB Search] Product filter found ${articles.length} articles`);
  }

  if (articles.length > 0) {
    try {
      await KnowledgeBaseStatisticsStorage.recordMultipleArticleViews(
        articles.map(a => ({ id: a.id })),
        { 
          keywords: keywordsStr || undefined,
          conversationId: context.conversationId,
          externalConversationId: context.externalConversationId
        }
      );
      console.log(`[KB Search] Recorded ${articles.length} article views`);
    } catch (error) {
      console.error("[KB Search] Failed to record article views:", error);
    }
  }

  return {
    articles,
    productId: productId || null
  };
}

async function runTextBasedSearch(
  keywordsStr: string,
  productId: number | undefined,
  limit: number
): Promise<KBArticleResult[]> {
  const searchTerms = keywordsStr
    .split(/\s+/)
    .filter(t => t.length >= 2);

  if (searchTerms.length === 0) {
    console.log(`[KB Search] Text search: no valid search terms`);
    return [];
  }

  // Use FTS to search across full corpus first (more candidates for better coverage)
  const ftsResults = await knowledgeBaseStorage.searchArticlesWithRelevance(keywordsStr, {
    productId,
    limit: limit * 5 // Get more candidates to re-score
  });

  // Apply calculateMatchScore on top of FTS results for better scoring
  const scoredArticles = ftsResults.map(article => {
    const { score, reason } = calculateMatchScore(article, searchTerms);
    // O FTS score já vem em escala absoluta (não 0-1), então não multiplicamos por 100
    // Apenas garantimos que fique no range 0-100
    const ftsScoreNormalized = Math.min(100, Math.round(article.relevanceScore));
    const combinedScore = Math.max(score, ftsScoreNormalized);
    return {
      id: article.id,
      name: article.name,
      productStandard: article.productStandard,
      subproductStandard: article.subproductStandard,
      intentId: article.intentId,
      description: article.description,
      resolution: article.resolution,
      observations: article.observations,
      relevanceScore: combinedScore, // Scale 0-100 like problems
      matchReason: score > 0 ? reason : `FTS score: ${ftsScoreNormalized}%`
    };
  });

  // Filter articles with score > 0 and sort by score (aligned with problem search)
  const filteredArticles = scoredArticles
    .filter(a => a.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  console.log(`[KB Search] Text search found ${filteredArticles.length} articles (from ${ftsResults.length} FTS candidates)`);
  
  return filteredArticles;
}
