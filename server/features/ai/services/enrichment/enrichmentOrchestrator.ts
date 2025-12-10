import { randomUUID } from "crypto";
import { callOpenAIForIntent } from "./enrichmentOpenAICaller.js";
import { saveEnrichmentLog, markLogError, updateLogWithSuggestion } from "./enrichmentRunLogger.js";
import { processEnrichmentPayload } from "./enrichmentRunProcessor.js";
import type { EnrichmentParams, EnrichmentResult } from "./types.js";

export async function generateEnrichmentSuggestions(params: EnrichmentParams): Promise<EnrichmentResult> {
  const suggestions: Array<{ id: number; type: string; intentId: number; articleId?: number; product?: string }> = [];
  const errors: string[] = [];
  let articlesCreated = 0;
  let articlesUpdated = 0;
  let skipped = 0;
  
  const triggerRunId = randomUUID();
  console.log(`[Enrichment Orchestrator] Starting batch run: ${triggerRunId} with ${params.intentsWithArticles.length} intents`);

  for (const intentWithArticle of params.intentsWithArticles) {
    const { intent, article } = intentWithArticle;
    
    try {
      console.log(`[Enrichment Orchestrator] Processing intent #${intent.id}: ${intent.name} (hasArticle: ${!!article})`);
      
      const payload = await callOpenAIForIntent(intentWithArticle, params.config);
      
      const logResult = await saveEnrichmentLog(intentWithArticle, payload, triggerRunId);
      
      if (!payload.success) {
        errors.push(payload.error || `Error processing intent #${intent.id}`);
        skipped++;
        continue;
      }

      if (!logResult.hasSuggestion) {
        skipped++;
        continue;
      }

      const processResult = await processEnrichmentPayload(intentWithArticle, payload, logResult.logId);
      
      if (!processResult.success) {
        await markLogError(logResult.logId, processResult.error || 'Processing failed');
        errors.push(processResult.error || `Error processing intent #${intent.id}`);
        skipped++;
        continue;
      }

      if (processResult.action === 'create') {
        articlesCreated++;
        if (processResult.suggestionId) {
          await updateLogWithSuggestion(logResult.logId, processResult.suggestionId);
          suggestions.push({
            id: processResult.suggestionId,
            type: 'create',
            intentId: intent.id,
            articleId: processResult.newArticleId,
            product: intent.productName
          });
        }
      } else if (processResult.action === 'update') {
        articlesUpdated++;
        if (processResult.suggestionId) {
          await updateLogWithSuggestion(logResult.logId, processResult.suggestionId);
          suggestions.push({
            id: processResult.suggestionId,
            type: 'update',
            intentId: intent.id,
            articleId: article?.id,
            product: intent.productName
          });
        }
      } else {
        skipped++;
      }

    } catch (error: any) {
      console.error(`[Enrichment Orchestrator] Error processing intent #${intent.id}:`, error.message);
      errors.push(`Intent #${intent.id}: ${error.message}`);
      skipped++;
      
      try {
        await saveEnrichmentLog(intentWithArticle, {
          success: false,
          action: 'skip',
          error: error.message,
          skipReason: `Processing error: ${error.message}`
        }, triggerRunId);
      } catch (logError: any) {
        console.error(`[Enrichment Orchestrator] Failed to save error log for intent #${intent.id}:`, logError.message);
      }
    }
  }

  const total = params.intentsWithArticles.length;
  let message = "";
  if (articlesCreated > 0 || articlesUpdated > 0) {
    const parts: string[] = [];
    if (articlesCreated > 0) parts.push(`${articlesCreated} artigo(s) criado(s)`);
    if (articlesUpdated > 0) parts.push(`${articlesUpdated} artigo(s) atualizado(s)`);
    if (skipped > 0) parts.push(`${skipped} ignorado(s)`);
    message = parts.join(", ");
  } else if (skipped > 0) {
    message = `${skipped} intenção(ões) ignorada(s) - artigos já estão completos ou sem informação suficiente no Zendesk`;
  } else if (total === 0) {
    message = "Nenhuma intenção encontrada com os filtros aplicados";
  }

  console.log(`[Enrichment Orchestrator] Batch completed: created=${articlesCreated}, updated=${articlesUpdated}, skipped=${skipped}`);

  return {
    success: errors.length === 0,
    intentsProcessed: total,
    articlesCreated,
    articlesUpdated,
    suggestionsGenerated: suggestions.length,
    skipped,
    suggestions,
    errors: errors.length > 0 ? errors : undefined,
    message
  };
}

export type { EnrichmentConfig, EnrichmentParams, EnrichmentResult } from "./types.js";
