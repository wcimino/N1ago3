import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { extractMatchedTerms } from "../../../shared/utils/matchScoring.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { generateEmbedding } from "../../../shared/embeddings/index.js";
import { 
  type MultiQuerySearchQueries,
  generateMultiQueryEmbeddings,
  aggregateMultiQueryResults,
  buildMatchReasonFromQueries,
  type SearchResultWithId
} from "../../../shared/embeddings/multiQuerySearch.js";

export interface KBSearchParams {
  productContext?: string;
  keywords?: string | string[];
  conversationContext?: string;
  searchQueries?: MultiQuerySearchQueries;
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

const SUBPRODUCT_BOOST = 1.05;
const PRODUCT_MISMATCH_PENALTY = 0.90;

async function applyProductMatchBoost(
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
  const contextHasSubproduct = normalizedProductContext.includes(" > ");

  return articles.map(article => {
    if (!article.productId) {
      return article;
    }

    const articleProductName = productNameMap.get(article.productId);
    if (!articleProductName) {
      return article;
    }

    const isExactMatch = articleProductName === normalizedProductContext;
    const isPartialMatch = articleProductName.includes(normalizedProductContext) || 
                           normalizedProductContext.includes(articleProductName);

    if (isExactMatch && contextHasSubproduct) {
      const boostedScore = article.relevanceScore * SUBPRODUCT_BOOST;
      console.log(`[KB Search] Subproduct match boost: "${articleProductName}" - score ${article.relevanceScore.toFixed(1)} -> ${boostedScore.toFixed(1)} (+5%)`);
      return {
        ...article,
        relevanceScore: boostedScore,
        matchReason: `${article.matchReason || ''} [subproduto exato: +5%]`.trim()
      };
    }

    if (isPartialMatch) {
      return article;
    }

    const penalizedScore = article.relevanceScore * PRODUCT_MISMATCH_PENALTY;
    console.log(`[KB Search] Product mismatch penalty: "${articleProductName}" vs "${productContext}" - score ${article.relevanceScore.toFixed(1)} -> ${penalizedScore.toFixed(1)} (-10%)`);
    
    return {
      ...article,
      relevanceScore: penalizedScore,
      matchReason: `${article.matchReason || ''} [produto diferente: -10%]`.trim()
    };
  });
}

export async function runKnowledgeBaseSearch(
  params: KBSearchParams,
  context: KBSearchContext = {}
): Promise<KBSearchResult> {
  const { productContext, conversationContext, searchQueries, limit = 5 } = params;

  if (productContext) {
    console.log(`[KB Search] Using productContext="${productContext}"`);
  }

  const keywordsStr = Array.isArray(params.keywords) 
    ? params.keywords.join(" ") 
    : params.keywords || "";

  let articles: KBArticleResult[] = [];
  const hasEmbeddings = await knowledgeBaseStorage.hasEmbeddings();

  const hasMultiQuery = searchQueries && (
    searchQueries.verbatimQuery?.trim() || 
    searchQueries.keywordQuery?.trim() || 
    searchQueries.normalizedQuery?.trim()
  );

  if (hasMultiQuery && hasEmbeddings) {
    try {
      console.log(`[KB Search] Multi-query semantic search with 3 queries`);
      
      const embeddings = await generateMultiQueryEmbeddings(searchQueries!, productContext);
      console.log(`[KB Search] Generated embeddings for queries: ${embeddings.validQueries.join(", ")}`);
      
      const searchLimit = 20;
      const searchPromises: Promise<{ type: string; results: any[] }>[] = [];
      
      if (embeddings.verbatimEmbedding) {
        searchPromises.push(
          knowledgeBaseStorage.searchBySimilarity(embeddings.verbatimEmbedding, { limit: searchLimit })
            .then(results => ({ type: "verbatim", results }))
        );
      }
      if (embeddings.keywordEmbedding) {
        searchPromises.push(
          knowledgeBaseStorage.searchBySimilarity(embeddings.keywordEmbedding, { limit: searchLimit })
            .then(results => ({ type: "keyword", results }))
        );
      }
      if (embeddings.normalizedEmbedding) {
        searchPromises.push(
          knowledgeBaseStorage.searchBySimilarity(embeddings.normalizedEmbedding, { limit: searchLimit })
            .then(results => ({ type: "normalized", results }))
        );
      }
      
      const allResults = await Promise.all(searchPromises);
      
      const verbatimResults = allResults.find(r => r.type === "verbatim")?.results || [];
      const keywordResults = allResults.find(r => r.type === "keyword")?.results || [];
      const normalizedResults = allResults.find(r => r.type === "normalized")?.results || [];
      
      console.log(`[KB Search] Results - verbatim: ${verbatimResults.length}, keyword: ${keywordResults.length}, normalized: ${normalizedResults.length}`);
      
      const toSearchResult = (a: any): SearchResultWithId => ({
        id: a.id,
        similarity: a.similarity,
        question: a.question,
        answer: a.answer,
        keywords: a.keywords,
        questionVariation: a.questionVariation,
        productId: a.productId,
        intentId: a.intentId,
      });
      
      const aggregatedResults = aggregateMultiQueryResults(
        verbatimResults.map(toSearchResult),
        keywordResults.map(toSearchResult),
        normalizedResults.map(toSearchResult),
        10
      );
      
      const queryForMatching = [
        searchQueries!.verbatimQuery || "",
        searchQueries!.keywordQuery || "",
        searchQueries!.normalizedQuery || ""
      ].filter(Boolean).join(" ");
      
      articles = aggregatedResults.map(aggResult => {
        const a = aggResult.result;
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
          relevanceScore: aggResult.finalScore,
          matchReason: buildMatchReasonFromQueries(aggResult.queryMatches, aggResult.finalScore, aggResult.isAmbiguous),
          matchedTerms: extractMatchedTerms(queryForMatching, articleText)
        };
      });
      
      console.log(`[KB Search] Multi-query aggregated ${articles.length} articles`);
    } catch (error) {
      console.error("[KB Search] Multi-query search failed:", error);
      articles = [];
    }
  }

  const enrichedContext = productContext && conversationContext
    ? `Produto: ${productContext}. ${conversationContext}`
    : conversationContext;

  if (articles.length === 0 && enrichedContext && enrichedContext.trim().length > 0 && hasEmbeddings) {
    console.log(`[KB Search] Fallback: Hybrid search using conversationContext for embedding`);
    
    try {
      const { embedding } = await generateEmbedding(enrichedContext, { contextType: "query" });
      
      const semanticResults = await knowledgeBaseStorage.searchBySimilarity(embedding, { 
        limit: keywordsStr ? limit * 2 : limit 
      });

      if (semanticResults.length > 0) {
        articles = semanticResults.map((a: any) => {
          const articleText = [
            a.question || "",
            a.answer || "",
            a.keywords || "",
            ...(Array.isArray(a.questionVariation) ? a.questionVariation : [])
          ].join(" ");
          const queryForMatching = conversationContext + (keywordsStr ? " " + keywordsStr : "");
          return {
            id: a.id,
            question: a.question,
            answer: a.answer,
            keywords: a.keywords,
            questionVariation: Array.isArray(a.questionVariation) ? a.questionVariation : [],
            productId: a.productId,
            intentId: a.intentId,
            relevanceScore: a.similarity,
            matchReason: `Similaridade semântica (contexto): ${a.similarity}%`,
            matchedTerms: extractMatchedTerms(queryForMatching, articleText)
          };
        });
        console.log(`[KB Search] Hybrid search found ${articles.length} articles`);
      }
    } catch (error) {
      console.error("[KB Search] Hybrid search failed:", error);
    }
  }

  if (articles.length === 0 && keywordsStr && hasEmbeddings) {
    const enrichedKeywords = productContext 
      ? `Produto: ${productContext}. ${keywordsStr}`
      : keywordsStr;
    console.log(`[KB Search] Fallback: Semantic search using keywords "${keywordsStr}"`);
    
    try {
      const { embedding } = await generateEmbedding(enrichedKeywords, { contextType: "query" });
      
      const semanticResults = await knowledgeBaseStorage.searchBySimilarity(embedding, { limit });

      if (semanticResults.length > 0) {
        articles = semanticResults.map((a: any) => {
          const articleText = [
            a.question || "",
            a.answer || "",
            a.keywords || "",
            ...(Array.isArray(a.questionVariation) ? a.questionVariation : [])
          ].join(" ");
          return {
            id: a.id,
            question: a.question,
            answer: a.answer,
            keywords: a.keywords,
            questionVariation: Array.isArray(a.questionVariation) ? a.questionVariation : [],
            productId: a.productId,
            intentId: a.intentId,
            relevanceScore: a.similarity,
            matchReason: `Similaridade semântica: ${a.similarity}%`,
            matchedTerms: extractMatchedTerms(keywordsStr, articleText)
          };
        });
        console.log(`[KB Search] Keyword semantic search found ${articles.length} articles`);
      }
    } catch (error) {
      console.error("[KB Search] Keyword semantic search failed:", error);
    }
  }

  if (articles.length > 0) {
    articles = await applyProductMatchBoost(articles, productContext);
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
