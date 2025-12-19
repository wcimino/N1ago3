import { randomUUID } from "crypto";
import { ArticleEnrichmentAgent } from "./articleEnrichmentAgent.js";
import { articleEnrichmentLogStorage } from "../../storage/articleEnrichmentLogStorage.js";
import { knowledgeSuggestionsStorage } from "../../storage/knowledgeSuggestionsStorage.js";
import type { IntentWithArticle } from "../../storage/knowledgeBaseTypes.js";
import type { InsertKnowledgeEnrichmentLog } from "../../../../../shared/schema.js";
import type { ArticleEnrichmentBatchResult, ArticleEnrichmentResult } from "./types.js";

interface BatchParams {
  intentsWithArticles: IntentWithArticle[];
}

interface LogResult {
  logId: number;
  hasSuggestion: boolean;
}

async function saveLog(
  intentWithArticle: IntentWithArticle,
  result: ArticleEnrichmentResult,
  triggerRunId: string
): Promise<LogResult> {
  const { intent, article } = intentWithArticle;
  
  const hasSuggestion = result.success && 
    result.action === "update";

  const outcomeReason = result.action === "skip" 
    ? (result.skipReason || "Sem sugestão de melhoria")
    : result.action === "update"
    ? (result.updateReason || "Artigo atualizado")
    : (result.error || "Erro no processamento");

  const logData: InsertKnowledgeEnrichmentLog = {
    intentId: intent.id,
    articleId: article?.id || null,
    action: result.action || "skip",
    outcomeReason,
    suggestionId: null,
    sourceArticles: result.sourceArticles || null,
    confidenceScore: result.confidenceScore || null,
    productStandard: intent.productName,
    outcomePayload: {
      result,
      hasSuggestion
    },
    openaiLogId: result.openaiLogId || null,
    triggerRunId,
    processedAt: new Date()
  };

  console.log(`[ArticleEnrichmentOrchestrator] Saving log for intent #${intent.id}: action=${result.action || "skip"}, hasSuggestion=${hasSuggestion}`);

  const log = await articleEnrichmentLogStorage.create(logData);

  return {
    logId: log.id,
    hasSuggestion
  };
}

async function createSuggestion(
  intentWithArticle: IntentWithArticle,
  result: ArticleEnrichmentResult,
  logId: number
): Promise<number | null> {
  const { intent, article } = intentWithArticle;

  if (!article) {
    console.log(`[ArticleEnrichmentOrchestrator] No article found for intent #${intent.id}, skipping suggestion`);
    return null;
  }

  if (result.action !== "update") {
    return null;
  }

  console.log(`[ArticleEnrichmentOrchestrator] Creating refinement suggestion for article #${article.id}`);
  
  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId: null,
    externalConversationId: null,
    suggestionType: "update",
    name: article.question || intent.name,
    productStandard: intent.productName,
    subproductStandard: intent.subproductName,
    question: article.question,
    answer: result.answer,
    keywords: result.keywords,
    questionVariation: result.questionVariation || [],
    confidenceScore: result.confidenceScore,
    similarArticleId: article.id,
    updateReason: result.updateReason,
    status: "pending",
    conversationHandler: null,
    rawExtraction: {
      sourceArticles: result.sourceArticles,
      intentId: intent.id,
      intentName: intent.name,
      subjectName: intent.subjectName,
      productName: intent.productName,
      subproductName: intent.subproductName,
      enrichmentSource: "article_enrichment",
      logId,
      originalQuestion: article.question,
      originalAnswer: article.answer,
      originalKeywords: article.keywords,
      originalQuestionVariation: article.questionVariation,
      questionNormalized: result.questionNormalized || []
    }
  });

  console.log(`[ArticleEnrichmentOrchestrator] Suggestion created: id=${suggestion.id} for article #${article.id}`);

  return suggestion.id;
}

export async function generateArticleEnrichmentSuggestions(
  params: BatchParams
): Promise<ArticleEnrichmentBatchResult> {
  const suggestions: Array<{ id: number; type: "update" | "skip"; intentId: number; articleId?: number; product?: string }> = [];
  const errors: string[] = [];
  let articlesUpdated = 0;
  let skipped = 0;
  
  const triggerRunId = randomUUID();
  console.log(`[ArticleEnrichmentOrchestrator] Starting batch run: ${triggerRunId} with ${params.intentsWithArticles.length} intents`);

  for (const intentWithArticle of params.intentsWithArticles) {
    const { intent, article } = intentWithArticle;
    
    try {
      console.log(`[ArticleEnrichmentOrchestrator] Processing intent #${intent.id}: ${intent.name} (hasArticle: ${!!article})`);
      
      const result = await ArticleEnrichmentAgent.process(intentWithArticle);
      
      const logResult = await saveLog(intentWithArticle, result, triggerRunId);
      
      if (!result.success) {
        errors.push(result.error || `Error processing intent #${intent.id}`);
        skipped++;
        continue;
      }

      if (!logResult.hasSuggestion) {
        skipped++;
        continue;
      }

      const suggestionId = await createSuggestion(intentWithArticle, result, logResult.logId);

      if (suggestionId) {
        await articleEnrichmentLogStorage.updateSuggestionId(logResult.logId, suggestionId);
        articlesUpdated++;
        suggestions.push({
          id: suggestionId,
          type: "update",
          intentId: intent.id,
          articleId: article?.id,
          product: intent.productName
        });
      } else {
        skipped++;
      }

    } catch (error: any) {
      console.error(`[ArticleEnrichmentOrchestrator] Error processing intent #${intent.id}:`, error.message);
      errors.push(`Intent #${intent.id}: ${error.message}`);
      skipped++;
      
      try {
        await saveLog(intentWithArticle, {
          success: false,
          action: "skip",
          error: error.message,
          skipReason: `Processing error: ${error.message}`
        }, triggerRunId);
      } catch (logError: any) {
        console.error(`[ArticleEnrichmentOrchestrator] Failed to save error log for intent #${intent.id}:`, logError.message);
      }
    }
  }

  const total = params.intentsWithArticles.length;
  let message = "";
  if (articlesUpdated > 0) {
    const parts: string[] = [];
    if (articlesUpdated > 0) parts.push(`${articlesUpdated} artigo(s) com sugestão de atualização`);
    if (skipped > 0) parts.push(`${skipped} ignorado(s)`);
    message = parts.join(", ");
  } else if (skipped > 0) {
    message = `${skipped} intenção(ões) ignorada(s) - artigos já estão completos ou sem informação suficiente`;
  } else if (total === 0) {
    message = "Nenhuma intenção encontrada com os filtros aplicados";
  }

  console.log(`[ArticleEnrichmentOrchestrator] Batch completed: updated=${articlesUpdated}, skipped=${skipped}`);

  return {
    success: errors.length === 0,
    intentsProcessed: total,
    articlesUpdated,
    suggestionsGenerated: suggestions.length,
    skipped,
    suggestions: suggestions.map(s => ({
      id: s.id,
      intentId: s.intentId,
      articleId: s.articleId,
      type: s.type,
      product: s.product,
      status: "pending" as const,
    })),
    errors: errors.length > 0 ? errors : undefined,
    message
  };
}
