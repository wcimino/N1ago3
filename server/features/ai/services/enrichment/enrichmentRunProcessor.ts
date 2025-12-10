import { knowledgeSuggestionsStorage } from "../../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseStorage, type IntentWithArticle } from "../../storage/knowledgeBaseStorage.js";
import type { OpenAIPayload } from "./types.js";

export interface ProcessResult {
  success: boolean;
  action: 'create' | 'update' | 'skip';
  suggestionId?: number;
  newArticleId?: number;
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

  let newArticleId: number | undefined;
  let targetArticleId: number | null = article?.id || null;

  if (payload.action === 'create') {
    console.log(`[Run Processor] Creating article for intent #${intent.id}`);
    const newArticle = await knowledgeBaseStorage.createArticle({
      name: payload.name || intent.name,
      productStandard: intent.productName,
      subproductStandard: null,
      category1: null,
      category2: null,
      subjectId: intent.subjectId,
      intentId: intent.id,
      intent: intent.name,
      description: payload.description || "",
      resolution: payload.resolution || "",
      observations: payload.observations || null,
    });
    
    newArticleId = newArticle.id;
    targetArticleId = newArticle.id;
    console.log(`[Run Processor] Article created: id=${newArticle.id}`);
  }

  console.log(`[Run Processor] Creating suggestion for intent #${intent.id}`);
  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId: null,
    externalConversationId: null,
    suggestionType: payload.action,
    name: payload.name || article?.name || intent.name,
    productStandard: intent.productName,
    subproductStandard: null,
    category1: null,
    category2: null,
    description: payload.description || article?.description,
    resolution: payload.resolution || article?.resolution,
    observations: payload.observations || article?.observations,
    confidenceScore: payload.confidenceScore,
    similarArticleId: targetArticleId,
    updateReason: payload.updateReason || payload.createReason,
    status: "pending",
    conversationHandler: null,
    rawExtraction: {
      ...payload,
      intentId: intent.id,
      intentName: intent.name,
      subjectName: intent.subjectName,
      productName: intent.productName,
      enrichmentSource: "zendesk",
      newArticleId,
      logId
    }
  });

  console.log(`[Run Processor] Suggestion created: id=${suggestion.id} for intent #${intent.id}`);

  return {
    success: true,
    action: payload.action,
    suggestionId: suggestion.id,
    newArticleId
  };
}
