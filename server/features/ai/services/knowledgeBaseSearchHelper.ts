import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { generateEmbedding } from "../../../shared/embeddings/index.js";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";
import { normalizeText, calculateMatchScore as sharedCalculateMatchScore, parseSearchTerms, extractMatchedTerms, type MatchField } from "../../../shared/utils/matchScoring.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";

export interface KBSearchParams {
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

    let keywordMultiplier = 1.0;
    const matchedKeywords: string[] = [];

    for (const term of searchTerms) {
      const normalizedTerm = normalizeText(term);
      if (articleContent.includes(normalizedTerm)) {
        keywordMultiplier *= 1.02;
        matchedKeywords.push(term);
      }
    }

    const boostedScore = Math.min(100, article.relevanceScore * keywordMultiplier);
    const matchReason = matchedKeywords.length > 0
      ? `${article.matchReason} + keywords(x${keywordMultiplier.toFixed(2)}): ${matchedKeywords.join(", ")}`
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

async function applyProductMismatchPenalty(
  articles: KBArticleResult[],
  productContext?: string
): Promise<KBArticleResult[]> {
  if (!productContext || articles.length === 0) {
    return articles;
  }

  const productIds = [...new Set(articles.filter(a => a.productId).map(a => a.productId!))];
  if (productIds.length === 0) {
    return articles;
  }

  const productNameMap = new Map<number, string>();
  for (const productId of productIds) {
    const resolved = await productCatalogStorage.resolveProductContext(productId);
    if (resolved) {
      productNameMap.set(productId, resolved.toLowerCase());
    }
  }

  const normalizedProductContext = productContext.toLowerCase();

  return articles.map(article => {
    if (!article.productId) {
      return article;
    }

    const articleProductName = productNameMap.get(article.productId);
    if (!articleProductName) {
      return article;
    }

    const isMatch = articleProductName.includes(normalizedProductContext) || 
                    normalizedProductContext.includes(articleProductName);

    if (isMatch) {
      return article;
    }

    const penalizedScore = article.relevanceScore * 0.90;
    console.log(`[KB Search] Product mismatch penalty: "${articleProductName}" vs "${productContext}" - score ${article.relevanceScore.toFixed(1)} -> ${penalizedScore.toFixed(1)}`);
    
    return {
      ...article,
      relevanceScore: penalizedScore,
      matchReason: `${article.matchReason} [produto diferente: -10%]`
    };
  });
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  const { productContext, conversationContext, limit = 5 } = params;

  if (productContext) {
    console.log(`[KB Search] Using productContext="${productContext}"`);
  }

  const keywordsStr = Array.isArray(params.keywords) 
    ? params.keywords.join(" ") 
    : params.keywords || "";

  let articles: KBArticleResult[] = [];
  const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();

  const enrichedContext = productContext && conversationContext
    ? `Produto: ${productContext}. ${conversationContext}`
    : conversationContext;

  if (enrichedContext && enrichedContext.trim().length > 0 && hasEmbeddings) {
    try {
      console.log(`[KB Search] Semantic search with enrichedContext`);
      
      const { embedding: contextEmbedding } = await generateEmbedding(enrichedContext, { contextType: "query" });
      const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
        contextEmbedding,
        { limit: keywordsStr ? limit * 2 : limit }
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
      console.error("[KB Search] Semantic search failed, falling back to keywords-only search:", error);
      if (keywordsStr) {
        articles = await runTextBasedSearch(keywordsStr, limit);
      }
    }
  } else if (keywordsStr && keywordsStr.trim().length > 0) {
    const enrichedKeywords = productContext 
      ? `Produto: ${productContext}. ${keywordsStr}`
      : keywordsStr;
    if (hasEmbeddings) {
      try {
        console.log(`[KB Search] Semantic search (keywords): "${keywordsStr.substring(0, 50)}..."`);
        
        const { embedding: queryEmbedding } = await generateEmbedding(enrichedKeywords, { contextType: "query" });
        const semanticResults = await knowledgeBaseStorage.searchBySimilarity(
          queryEmbedding,
          { limit }
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
        articles = await runTextBasedSearch(keywordsStr, limit);
      }
    } else {
      console.log(`[KB Search] No embeddings available, using text search: keywords="${keywordsStr.substring(0, 50)}..."`);
      articles = await runTextBasedSearch(keywordsStr, limit);
    }
  }

  if (articles.length > 0) {
    articles = await applyProductMismatchPenalty(articles, productContext);
    articles = articles
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
    
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
    productId: null
  };
}

async function runTextBasedSearch(
  keywordsStr: string,
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
