import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { knowledgeSubjectsStorage } from "../../knowledge/storage/knowledgeSubjectsStorage.js";
import { knowledgeIntentsStorage } from "../../knowledge/storage/knowledgeIntentsStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding as generateKBEmbedding } from "./knowledgeBaseEmbeddingService.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";

const RELEVANCE_THRESHOLD = 0.05;

export interface KBSearchParams {
  product?: string;
  subproduct?: string;
  subject?: string;
  intent?: string;
  keywords?: string | string[];
  limit?: number;
  useSimpleSearch?: boolean;
  minScore?: number;
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
  resolvedSubject: string | null;
  resolvedIntent: string | null;
  subjectId: number | null;
  intentId: number | null;
}

function buildEnrichedQueryText(params: {
  keywords: string;
  product?: string;
  subproduct?: string;
  subject?: string;
  intent?: string;
}): string {
  const parts: string[] = [];
  
  if (params.product) {
    parts.push(`Produto: ${params.product}`);
  }
  if (params.subproduct) {
    parts.push(`Subproduto: ${params.subproduct}`);
  }
  
  const descriptionParts: string[] = [];
  if (params.subject) {
    descriptionParts.push(params.subject);
  }
  if (params.intent) {
    descriptionParts.push(params.intent);
  }
  descriptionParts.push(params.keywords);
  
  parts.push(`Descrição: ${descriptionParts.join(". ")}`);
  parts.push(`Resolução: ${params.keywords}`);
  
  return parts.join("\n\n");
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  let subjectId: number | null = null;
  let intentId: number | null = null;
  let resolvedSubject: string | null = null;
  let resolvedIntent: string | null = null;

  if (params.subject) {
    const subjects = await knowledgeSubjectsStorage.findByNameOrSynonym(params.subject);
    if (subjects.length > 0) {
      subjectId = subjects[0].id;
      resolvedSubject = subjects[0].name;
    }
  }

  if (params.intent) {
    const intents = await knowledgeIntentsStorage.findByNameOrSynonym(params.intent, subjectId ?? undefined);
    if (intents.length > 0) {
      intentId = intents[0].id;
      resolvedIntent = intents[0].name;
    }
  }

  const keywordsArray = Array.isArray(params.keywords) 
    ? params.keywords 
    : params.keywords?.split(/\s+/).filter(k => k.length > 0) || [];
  
  const keywordsStr = keywordsArray.join(" ");
  
  const limit = params.limit || 5;
  const minScore = params.minScore || 20;

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

  if (params.useSimpleSearch) {
    console.log(`[KB Search] Using simple search: product=${params.product || 'none'}, keywords=${keywordsArray.length}`);
    const results = await knowledgeBaseService.findRelatedArticles(
      params.product,
      keywordsArray,
      { limit, minScore }
    );
    
    articles = results.map(r => ({
      id: r.article.id,
      name: r.article.name,
      productStandard: r.article.productStandard,
      subproductStandard: r.article.subproductStandard,
      intentId: r.article.intentId,
      description: r.article.description,
      resolution: r.article.resolution,
      observations: r.article.observations,
      relevanceScore: r.relevanceScore / 100
    }));
    
    console.log(`[KB Search] Simple search found ${articles.length} articles`);
  } else if (keywordsStr && keywordsStr.trim().length > 0) {
    const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();
    
    if (hasEmbeddings) {
      try {
        const queryText = buildEnrichedQueryText({
          keywords: keywordsStr,
          product: params.product,
          subproduct: params.subproduct,
          subject: resolvedSubject || undefined,
          intent: resolvedIntent || undefined,
        });
        console.log(`[KB Search] Semantic search: product=${params.product || 'none'}, subject=${resolvedSubject || 'none'}, intent=${resolvedIntent || 'none'}`);
        
        const { embedding: queryEmbedding } = await generateKBEmbedding(queryText);
        const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
          queryEmbedding,
          {
            productStandard: params.product,
            subjectId: subjectId ?? undefined,
            intentId: intentId ?? undefined,
            limit
          }
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
          productStandard: params.product,
          subjectId: subjectId ?? undefined,
          intentId: intentId ?? undefined,
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
      }
    } else {
      console.log("[KB Search] No embeddings available, using full-text search");
      const searchResults = await knowledgeBaseStorage.searchArticlesWithRelevance(keywordsStr, {
        productStandard: params.product,
        subjectId: subjectId ?? undefined,
        intentId: intentId ?? undefined,
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
    }
  } else {
    const allArticles = await knowledgeBaseStorage.getAllArticles({
      productStandard: params.product,
      subjectId: subjectId ?? undefined,
      intentId: intentId ?? undefined,
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
    resolvedSubject,
    resolvedIntent,
    subjectId,
    intentId
  };
}
