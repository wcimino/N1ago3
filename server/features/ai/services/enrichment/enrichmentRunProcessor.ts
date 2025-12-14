import { knowledgeSuggestionsStorage } from "../../storage/knowledgeSuggestionsStorage.js";
import type { IntentWithArticle } from "../../storage/knowledgeBaseStorage.js";
import type { OpenAIPayload } from "./types.js";

export interface ProcessResult {
  success: boolean;
  action: 'update' | 'skip';
  suggestionId?: number;
  error?: string;
}

export async function processEnrichmentPayload(
  intentWithArticle: IntentWithArticle,
  payload: OpenAIPayload,
  logId: number
): Promise<ProcessResult> {
  const { intent, article } = intentWithArticle;

  if (!payload.success) {
    return {
      success: false,
      action: 'skip',
      error: payload.error || 'OpenAI call failed'
    };
  }

  if (payload.action === 'skip' || !payload.action) {
    console.log(`[Run Processor] Skipping intent #${intent.id}: ${payload.skipReason || 'No suggestion'}`);
    return {
      success: true,
      action: 'skip'
    };
  }

  if (!article) {
    console.log(`[Run Processor] No article found for intent #${intent.id}, skipping`);
    return {
      success: true,
      action: 'skip'
    };
  }

  console.log(`[Run Processor] Creating refinement suggestion for article #${article.id}`);
  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId: null,
    externalConversationId: null,
    suggestionType: 'update',
    name: article.question || intent.name,
    productStandard: intent.productName,
    subproductStandard: intent.subproductName,
    question: payload.question,
    answer: payload.answer,
    keywords: payload.keywords,
    questionVariation: payload.questionVariation || [],
    confidenceScore: payload.confidenceScore,
    similarArticleId: article.id,
    updateReason: payload.updateReason,
    status: "pending",
    conversationHandler: null,
    rawExtraction: {
      sourceArticles: payload.sourceArticles,
      intentId: intent.id,
      intentName: intent.name,
      subjectName: intent.subjectName,
      productName: intent.productName,
      subproductName: intent.subproductName,
      enrichmentSource: "refinement",
      logId,
      originalQuestion: article.question,
      originalAnswer: article.answer,
      originalKeywords: article.keywords,
      originalQuestionVariation: article.questionVariation
    }
  });

  console.log(`[Run Processor] Suggestion created: id=${suggestion.id} for article #${article.id}`);

  return {
    success: true,
    action: 'update',
    suggestionId: suggestion.id
  };
}
