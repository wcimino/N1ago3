import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding as generateKBEmbedding } from "./knowledgeBaseEmbeddingService.js";

const RELEVANCE_THRESHOLD = 0.05;

export interface KBSearchParams {
  productId?: number;
  keywords?: string | string[];
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
}

export interface KBSearchResult {
  articles: KBArticleResult[];
  productId: number | null;
}

function buildEnrichedQueryText(keywords: string): string {
  return `Descrição: ${keywords}\n\nResolução: ${keywords}`;
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  const { productId, limit = 5 } = params;

  if (productId) {
    console.log(`[KB Search] Using productId=${productId}`);
  }

  const keywordsStr = Array.isArray(params.keywords) 
    ? params.keywords.join(" ") 
    : params.keywords || "";

  interface ArticleWithRelevance {
    id: number;
    name: string | null;
    productStandard: string;
    subproductStandard: string | null;
    intentId: number | null;
    description: string;
    resolution: string;
    observations: string | null;
    relevanceScore: number;
  }

  let articles: ArticleWithRelevance[] = [];

  if (keywordsStr && keywordsStr.trim().length > 0) {
    const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();
    
    if (hasEmbeddings) {
      try {
        const queryText = buildEnrichedQueryText(keywordsStr);
        console.log(`[KB Search] Semantic search: productId=${productId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
        
        const { embedding: queryEmbedding } = await generateKBEmbedding(queryText);
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
          relevanceScore: a.similarity
        }));
        
        console.log(`[KB Search] Semantic search found ${articles.length} articles`);
      } catch (error) {
        console.error("[KB Search] Semantic search failed, falling back to full-text:", error);
        const searchResults = await knowledgeBaseStorage.searchArticlesWithRelevance(keywordsStr, {
          productId,
          limit: limit * 2
        });
        articles = searchResults
          .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
          .slice(0, limit)
          .map(a => ({
            id: a.id,
            name: a.name,
            productStandard: a.productStandard,
            subproductStandard: a.subproductStandard,
            intentId: a.intentId,
            description: a.description,
            resolution: a.resolution,
            observations: a.observations,
            relevanceScore: a.relevanceScore
          }));
        console.log(`[KB Search] FTS fallback found ${articles.length} articles`);
      }
    } else {
      console.log(`[KB Search] No embeddings, using FTS: productId=${productId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
      const searchResults = await knowledgeBaseStorage.searchArticlesWithRelevance(keywordsStr, {
        productId,
        limit: limit * 2
      });
      articles = searchResults
        .filter(a => a.relevanceScore >= RELEVANCE_THRESHOLD)
        .slice(0, limit)
        .map(a => ({
          id: a.id,
          name: a.name,
          productStandard: a.productStandard,
          subproductStandard: a.subproductStandard,
          intentId: a.intentId,
          description: a.description,
          resolution: a.resolution,
          observations: a.observations,
          relevanceScore: a.relevanceScore
        }));
      console.log(`[KB Search] FTS found ${articles.length} articles`);
    }
  } else if (productId) {
    console.log(`[KB Search] No keywords, filtering by productId: ${productId}`);
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
      relevanceScore: 0
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
