import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";

export interface SearchArticleResult extends KnowledgeBaseArticle {
  relevanceScore: number;
  matchReason: string;
}

export interface IntentWithArticle {
  intent: {
    id: number;
    name: string;
    synonyms: string[];
    subjectId: number;
    subjectName: string;
    subjectSynonyms: string[];
    productName: string;
    subproductName: string | null;
  };
  article: KnowledgeBaseArticle | null;
}

export interface SemanticSearchResult {
  id: number;
  question: string | null;
  answer: string | null;
  keywords: string | null;
  questionVariation: string[];
  productId: number | null;
  subjectId: number | null;
  intentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}
