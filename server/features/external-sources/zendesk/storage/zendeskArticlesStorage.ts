export { 
  type ArticleFilters,
  getAllArticles,
  getArticleById,
  getArticleByZendeskId,
  getDistinctSections,
  getDistinctSubdomains,
  getArticleCount,
} from "./articlesCrud.js";

export {
  type SearchArticleResult,
  type SemanticSearchResult,
  searchArticlesWithRelevance,
  searchBySimilarity,
} from "./articlesSearch.js";

export {
  generateContentHash,
  getArticlesPendingEmbedding,
  upsertEmbedding,
  getArticlesWithEmbedding,
  getEmbeddingStats,
} from "./articlesEmbeddings.js";

import {
  getAllArticles,
  getArticleById,
  getArticleByZendeskId,
  getDistinctSections,
  getDistinctSubdomains,
  getArticleCount,
} from "./articlesCrud.js";

import {
  searchArticlesWithRelevance,
  searchBySimilarity,
} from "./articlesSearch.js";

import {
  generateContentHash,
  getArticlesPendingEmbedding,
  upsertEmbedding,
  getArticlesWithEmbedding,
  getEmbeddingStats,
} from "./articlesEmbeddings.js";

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
