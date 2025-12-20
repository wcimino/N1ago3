import { ZendeskArticlesStorage, type SemanticSearchResult } from "../../../external-sources/zendesk/storage/zendeskArticlesStorage.js";
import { generateEnrichedQueryEmbedding } from "../../../external-sources/zendesk/services/embeddingService.js";
import type { ArticleEnrichmentContext } from "./types.js";

export interface RetrievedArticle {
  id: number;
  zendeskId: string;
  title: string;
  body: string | null;
  sectionName: string | null;
  htmlUrl: string | null;
  similarity: number;
}

export interface RetrievalResult {
  articles: RetrievedArticle[];
  queryUsed: string;
  embeddingLogId: number | null;
}

export async function retrieveZendeskArticles(
  context: ArticleEnrichmentContext,
  options: { limit?: number; minSimilarity?: number } = {}
): Promise<RetrievalResult> {
  const { limit = 5, minSimilarity = 50 } = options;

  const question = context.article?.question || context.intentName;
  const keywords = context.article?.keywords || "";
  const productName = context.productName || "";

  if (!question) {
    console.log(`[ArticleRetrieval] No question/intent for context, skipping retrieval`);
    return {
      articles: [],
      queryUsed: "",
      embeddingLogId: null,
    };
  }

  const stats = await ZendeskArticlesStorage.getEmbeddingStats();
  if (stats.withEmbedding === 0) {
    console.log(`[ArticleRetrieval] No Zendesk articles with embeddings, skipping retrieval`);
    return {
      articles: [],
      queryUsed: question,
      embeddingLogId: null,
    };
  }

  try {
    const enrichedParams: { query: string; keywords?: string; productContext?: string } = {
      query: question,
    };
    if (keywords) {
      enrichedParams.keywords = keywords;
    }
    if (productName) {
      enrichedParams.productContext = productName;
    }

    const { embedding, logId, formattedQuery } = await generateEnrichedQueryEmbedding(enrichedParams);

    console.log(`[ArticleRetrieval] Generated embedding for: "${formattedQuery.substring(0, 100)}..."`);

    const results = await ZendeskArticlesStorage.searchBySimilarity(embedding, {
      limit,
      minSimilarity,
    });

    console.log(`[ArticleRetrieval] Found ${results.length} relevant articles (minSimilarity=${minSimilarity})`);

    const articles: RetrievedArticle[] = results.map((r) => ({
      id: r.id,
      zendeskId: r.zendeskId,
      title: r.title,
      body: r.body ? r.body.substring(0, 2000) : null,
      sectionName: r.sectionName,
      htmlUrl: r.htmlUrl,
      similarity: r.similarity,
    }));

    return {
      articles,
      queryUsed: formattedQuery,
      embeddingLogId: logId,
    };
  } catch (error: any) {
    console.error(`[ArticleRetrieval] Error retrieving articles:`, error.message);
    return {
      articles: [],
      queryUsed: question,
      embeddingLogId: null,
    };
  }
}

export function formatRetrievedArticlesForPrompt(articles: RetrievedArticle[]): string {
  if (articles.length === 0) {
    return "Nenhum artigo relevante encontrado na base do Zendesk.";
  }

  return articles
    .map((article, index) => {
      const bodyPreview = article.body
        ? article.body.substring(0, 1500) + (article.body.length > 1500 ? "..." : "")
        : "(sem conteúdo)";

      return `### Artigo ${index + 1}: ${article.title}
**Seção:** ${article.sectionName || "N/A"}
**Relevância:** ${article.similarity}%
**Conteúdo:**
${bodyPreview}
`;
    })
    .join("\n---\n\n");
}
