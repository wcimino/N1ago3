export type { 
  SearchArticleResult, 
  IntentWithArticle, 
  SemanticSearchResult 
} from "./knowledgeBaseTypes.js";

export { knowledgeBaseArticlesCrud } from "./knowledgeBaseArticlesCrud.js";
export { knowledgeBaseSearch } from "./knowledgeBaseSearch.js";
export { knowledgeBaseEmbeddingsStorage } from "./knowledgeBaseEmbeddings.js";

import { knowledgeBaseArticlesCrud } from "./knowledgeBaseArticlesCrud.js";
import { knowledgeBaseSearch } from "./knowledgeBaseSearch.js";
import { knowledgeBaseEmbeddingsStorage } from "./knowledgeBaseEmbeddings.js";

export const knowledgeBaseStorage = {
  ...knowledgeBaseArticlesCrud,
  ...knowledgeBaseSearch,
  ...knowledgeBaseEmbeddingsStorage,
};
