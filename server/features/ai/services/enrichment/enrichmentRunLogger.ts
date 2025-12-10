import { enrichmentLogStorage } from "../../storage/enrichmentLogStorage.js";
import type { InsertKnowledgeEnrichmentLog } from "../../../../../shared/schema.js";
import type { IntentWithArticle } from "../../storage/knowledgeBaseStorage.js";
import type { OpenAIPayload } from "./types.js";

export interface LogResult {
  logId: number;
  hasSuggestion: boolean;
}

export async function saveEnrichmentLog(
  intentWithArticle: IntentWithArticle,
  payload: OpenAIPayload,
  triggerRunId: string
): Promise<LogResult> {
  const { intent, article } = intentWithArticle;
  
  const hasSuggestion = payload.success && 
    payload.action !== 'skip' && 
    (payload.action === 'create' || payload.action === 'update');

  const outcomeReason = payload.action === 'skip' 
    ? (payload.skipReason || 'Sem sugestão de melhoria')
    : payload.action === 'create'
    ? (payload.createReason || 'Artigo criado')
    : payload.action === 'update'
    ? (payload.updateReason || 'Artigo atualizado')
    : (payload.error || 'Erro no processamento');

  const logData: InsertKnowledgeEnrichmentLog = {
    intentId: intent.id,
    articleId: article?.id || null,
    action: payload.action || 'skip',
    outcomeReason,
    suggestionId: null,
    sourceArticles: payload.sourceArticles || null,
    confidenceScore: payload.confidenceScore || null,
    productStandard: intent.productName,
    outcomePayload: {
      payload,
      hasSuggestion
    },
    openaiLogId: payload.openaiLogId || null,
    triggerRunId,
    processedAt: new Date()
  };

  console.log(`[Run Logger] Saving log for intent #${intent.id}: action=${payload.action || 'skip'}, hasSuggestion=${hasSuggestion}`);

  const log = await enrichmentLogStorage.create(logData);

  console.log(`[Run Logger] Log saved: id=${log.id} for intent #${intent.id}`);

  return {
    logId: log.id,
    hasSuggestion
  };
}

export async function updateLogWithSuggestion(
  logId: number,
  suggestionId: number
): Promise<void> {
  console.log(`[Run Logger] Updating log #${logId} with suggestionId=${suggestionId}`);
  await enrichmentLogStorage.updateSuggestionId(logId, suggestionId);
}

export async function markLogError(
  logId: number,
  error: string
): Promise<void> {
  console.log(`[Run Logger] Marking log #${logId} as error: ${error}`);
  await enrichmentLogStorage.markError(logId, error);
}
