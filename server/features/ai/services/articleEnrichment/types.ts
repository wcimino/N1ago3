import type { IntentWithArticle } from "../../storage/knowledgeBaseTypes.js";
import type { KnowledgeBaseArticle } from "../../../../../shared/schema.js";

export interface ArticleEnrichmentContext {
  intentId: number;
  intentName: string;
  intentSynonyms: string[];
  subjectId: number;
  subjectName: string;
  subjectSynonyms: string[];
  productName: string;
  subproductName: string | null;
  article: KnowledgeBaseArticle | null;
}

export interface ArticleEnrichmentResult {
  success: boolean;
  action?: "update" | "skip";
  answer?: string;
  keywords?: string;
  questionVariation?: string[];
  questionNormalized?: string[];
  updateReason?: string;
  skipReason?: string;
  confidenceScore?: number;
  sourceArticles?: Array<{ id: string; title: string; similarityScore: number }>;
  error?: string;
  openaiLogId?: number;
}

export interface ArticleEnrichmentSuggestion {
  id: number;
  intentId: number;
  articleId?: number;
  type: "update" | "skip";
  product?: string;
  answer?: string;
  keywords?: string;
  questionVariation?: string[];
  questionNormalized?: string[];
  updateReason?: string;
  skipReason?: string;
  confidenceScore?: number;
  status: "pending" | "approved" | "rejected";
}

export interface ArticleEnrichmentBatchResult {
  success: boolean;
  intentsProcessed: number;
  articlesUpdated: number;
  suggestionsGenerated: number;
  skipped: number;
  suggestions?: ArticleEnrichmentSuggestion[];
  errors?: string[];
  message?: string;
}

export interface ArticleEnrichmentLog {
  id?: number;
  intentId: number;
  triggerRunId: string;
  status: "pending" | "processed" | "error";
  hasSuggestion: boolean;
  payload: ArticleEnrichmentResult;
  outcomeReason: string;
  confidenceScore: number | null;
  productStandard: string;
  processedAt: Date;
}

export function buildArticleEnrichmentContext(intentWithArticle: IntentWithArticle): ArticleEnrichmentContext {
  const { intent, article } = intentWithArticle;
  return {
    intentId: intent.id,
    intentName: intent.name,
    intentSynonyms: intent.synonyms || [],
    subjectId: intent.subjectId,
    subjectName: intent.subjectName,
    subjectSynonyms: intent.subjectSynonyms || [],
    productName: intent.productName,
    subproductName: intent.subproductName,
    article,
  };
}
