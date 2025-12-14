import type { IntentWithArticle } from "../../storage/knowledgeBaseStorage.js";

export interface EnrichmentConfig {
  enabled: boolean;
  promptSystem: string | null;
  promptTemplate: string;
  responseFormat: string | null;
  modelName: string;
  useKnowledgeBaseTool: boolean;
  useZendeskKnowledgeBaseTool: boolean;
}

export interface EnrichmentParams {
  intentsWithArticles: IntentWithArticle[];
  config: EnrichmentConfig;
}

export interface EnrichmentResult {
  success: boolean;
  intentsProcessed: number;
  articlesCreated: number;
  articlesUpdated: number;
  suggestionsGenerated: number;
  skipped: number;
  suggestions?: Array<{
    id: number;
    type: string;
    intentId: number;
    articleId?: number;
    product?: string;
  }>;
  errors?: string[];
  message?: string;
}

export interface OpenAIPayload {
  success: boolean;
  action?: 'update' | 'skip';
  question?: string;
  answer?: string;
  keywords?: string;
  questionVariation?: string[];
  updateReason?: string;
  skipReason?: string;
  confidenceScore?: number;
  sourceArticles?: Array<{ id: string; title: string; similarityScore: number }>;
  error?: string;
  openaiLogId?: number;
}

export interface EnrichmentRunLog {
  id?: number;
  intentId: number;
  triggerRunId: string;
  status: 'pending' | 'processed' | 'error';
  hassuggestion: boolean;
  payload: OpenAIPayload;
  outcomeReason: string;
  confidenceScore: number | null;
  productStandard: string;
  processedAt: Date;
}
