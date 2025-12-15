import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding } from "../../../shared/embeddings/index.js";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";
import { normalizeText, calculateMatchScore as sharedCalculateMatchScore, parseSearchTerms, extractMatchedTerms, type MatchField } from "../../../shared/utils/matchScoring.js";

export interface KBSearchParams {
  productId?: number;
  productContext?: string;
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
  question: string | null;
  answer: string | null;
  keywords: string | null;
  questionVariation: string[];
  productId: number | null;
  intentId: number | null;
  relevanceScore: number;
  matchReason?: string;
  matchedTerms?: string[];
}

export interface KBSearchResult {
  articles: KBArticleResult[];
  productId: number | null;
}

function calculateArticleMatchScore(
  article: KnowledgeBaseArticle,
  searchTerms: string[]
): { score: number; reason: string } {
  const questionVariationsStr = Array.isArray(article.questionVariation) 
    ? (article.questionVariation as string[]).join(" ") 
    : "";
    
  const fields: MatchField[] = [
    { name: "Pergunta", value: article.question || "", weight: 'contains_name' },
    { name: "Resposta", value: article.answer || "", weight: 'contains_secondary' },
    { name: "Keywords", value: article.keywords || "", weight: 'contains_tertiary' },
    { name: "Variações", value: questionVariationsStr, weight: 'contains_low' },
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

  const boostedArticles = articles.map(article => {
    const questionVariationsStr = Array.isArray(article.questionVariation) 
      ? article.questionVariation.join(" ") 
      : "";
      
    const articleContent = normalizeText([
      article.question || "",
      article.answer || "",
      article.keywords || "",
      questionVariationsStr
    ].join(" "));

    let keywordBoost = 0;
    const matchedKeywords: string[] = [];

    for (const term of searchTerms) {
      const normalizedTerm = normalizeText(term);
      if (articleContent.includes(normalizedTerm)) {
        keywordBoost += 5;
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

  return boostedArticles
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  const { productId, productContext, conversationContext, limit = 5 } = params;

  if (productContext) {
    console.log(`[KB Search] Using productContext="${productContext}" (semantic, no filter)`);
  } else if (productId) {
    console.log(`[KB Search] Using productId=${productId} (filter mode)`);
  }

  const keywordsStr = Array.isArray(params.keywords) 
    ? params.keywords.join(" ") 
    : params.keywords || "";

  let articles: KBArticleResult[] = [];
  const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();

  const enrichedContext = productContext && conversationContext
    ? `Produto: ${productContext}. ${conversationContext}`
    : conversationContext;

  const effectiveProductId = productContext ? undefined : productId;

  if (enrichedContext && enrichedContext.trim().length > 0 && hasEmbeddings) {
    try {
      console.log(`[KB Search] Hybrid search: using enrichedContext for embedding, productId=${effectiveProductId || 'none (semantic only)'}`);
      
      const { embedding: contextEmbedding } = await generateEmbedding(enrichedContext, { contextType: "query" });
      const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
        contextEmbedding,
        { productId: effectiveProductId, limit: keywordsStr ? limit * 2 : limit }
      );
      
      articles = semanticResults.map(a => {
        const articleText = [
          a.question || "",
          a.answer || "",
          a.keywords || "",
          ...(Array.isArray(a.questionVariation) ? a.questionVariation as string[] : [])
        ].join(" ");
        const queryForMatching = conversationContext + (keywordsStr ? " " + keywordsStr : "");
        return {
          id: a.id,
          question: a.question,
          answer: a.answer,
          keywords: a.keywords,
          questionVariation: Array.isArray(a.questionVariation) ? a.questionVariation as string[] : [],
          productId: a.productId,
          intentId: a.intentId,
          relevanceScore: a.similarity,
          matchReason: `Similaridade semântica (contexto): ${a.similarity}%`,
          matchedTerms: extractMatchedTerms(queryForMatching, articleText)
        };
      });
      
      console.log(`[KB Search] Context-based semantic search found ${articles.length} articles`);

      if (keywordsStr && keywordsStr.trim().length > 0) {
        articles = applyKeywordsBoost(articles, keywordsStr, limit);
        console.log(`[KB Search] After keywords boost/filter: ${articles.length} articles`);
      }
    } catch (error) {
      console.error("[KB Search] Hybrid search failed, falling back to keywords-only search:", error);
      if (keywordsStr) {
        articles = await runTextBasedSearch(keywordsStr, effectiveProductId, limit);
      }
    }
  } else if (keywordsStr && keywordsStr.trim().length > 0) {
    const enrichedKeywords = productContext 
      ? `Produto: ${productContext}. ${keywordsStr}`
      : keywordsStr;
    if (hasEmbeddings) {
      try {
        console.log(`[KB Search] Semantic search (keywords): productId=${effectiveProductId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
        
        const { embedding: queryEmbedding } = await generateEmbedding(enrichedKeywords, { contextType: "query" });
        const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
          queryEmbedding,
          { productId: effectiveProductId, limit }
        );
        
        articles = semanticResults.map(a => {
          const articleText = [
            a.question || "",
            a.answer || "",
            a.keywords || "",
            ...(Array.isArray(a.questionVariation) ? a.questionVariation as string[] : [])
          ].join(" ");
          return {
            id: a.id,
            question: a.question,
            answer: a.answer,
            keywords: a.keywords,
            questionVariation: Array.isArray(a.questionVariation) ? a.questionVariation as string[] : [],
            productId: a.productId,
            intentId: a.intentId,
            relevanceScore: a.similarity,
            matchReason: `Similaridade semântica: ${a.similarity}%`,
            matchedTerms: extractMatchedTerms(keywordsStr, articleText)
          };
        });
        
        console.log(`[KB Search] Semantic search found ${articles.length} articles`);
      } catch (error) {
        console.error("[KB Search] Semantic search failed, falling back to text search:", error);
        articles = await runTextBasedSearch(keywordsStr, effectiveProductId, limit);
      }
    } else {
      console.log(`[KB Search] No embeddings available, using text search: productId=${effectiveProductId || 'none'}, keywords="${keywordsStr.substring(0, 50)}..."`);
      articles = await runTextBasedSearch(keywordsStr, effectiveProductId, limit);
    }
  } else if (effectiveProductId) {
    console.log(`[KB Search] No keywords or context, filtering by productId: ${effectiveProductId}`);
    const allArticles = await knowledgeBaseStorage.getAllArticles({
      productId: effectiveProductId,
      limit
    });
    articles = allArticles.map(a => ({
      id: a.id,
      question: a.question,
      answer: a.answer,
      keywords: a.keywords,
      questionVariation: Array.isArray(a.questionVariation) ? a.questionVariation as string[] : [],
      productId: a.productId,
      intentId: a.intentId,
      relevanceScore: 0,
      matchReason: "Listagem por produto",
      matchedTerms: []
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

  const ftsResults = await knowledgeBaseStorage.searchArticlesWithRelevance(keywordsStr, {
    productId,
    limit: limit * 5
  });

  const scoredArticles = ftsResults.map(article => {
    const { score, reason } = calculateArticleMatchScore(article, searchTerms);
    const articleText = [
      article.question || "",
      article.answer || "",
      article.keywords || "",
      ...(Array.isArray(article.questionVariation) ? article.questionVariation as string[] : [])
    ].join(" ");
    return {
      id: article.id,
      question: article.question,
      answer: article.answer,
      keywords: article.keywords,
      questionVariation: Array.isArray(article.questionVariation) ? article.questionVariation as string[] : [],
      productId: article.productId,
      intentId: article.intentId,
      relevanceScore: score,
      matchReason: reason,
      matchedTerms: extractMatchedTerms(keywordsStr, articleText)
    };
  });

  const filteredArticles = scoredArticles
    .filter(a => a.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  console.log(`[KB Search] Text search found ${filteredArticles.length} articles (from ${ftsResults.length} FTS candidates)`);
  
  return filteredArticles;
}
