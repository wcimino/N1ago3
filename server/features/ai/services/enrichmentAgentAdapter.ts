import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseStorage, IntentWithArticle } from "../storage/knowledgeBaseStorage.js";
import { enrichmentLogStorage } from "../storage/enrichmentLogStorage.js";
import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { createZendeskKnowledgeBaseTool } from "./aiTools.js";
import { ENRICHMENT_SYSTEM_PROMPT, ENRICHMENT_USER_PROMPT_TEMPLATE } from "../constants/enrichmentAgentPrompts.js";
import type { KnowledgeBaseArticle, InsertKnowledgeEnrichmentLog } from "../../../../shared/schema.js";
import { randomUUID } from "crypto";

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

interface ZendeskSourceArticle {
  id: string;
  title: string;
  similarityScore: number;
}

function buildCreateEnrichmentSuggestionTool(intentWithArticle: IntentWithArticle): ToolDefinition {
  const hasArticle = !!intentWithArticle.article;
  
  return {
    name: "create_enrichment_suggestion",
    description: hasArticle 
      ? "Registra uma sugestão de melhoria para o artigo existente baseada na comparação com artigos do Zendesk."
      : "Registra uma sugestão de criação de artigo para a intenção baseada nos artigos do Zendesk.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: hasArticle ? ["update", "skip"] : ["create", "skip"],
          description: hasArticle 
            ? "Ação a tomar: update (melhorar o artigo existente), skip (ignorar pois não há melhoria)"
            : "Ação a tomar: create (criar primeiro artigo), skip (ignorar pois não há informação suficiente)"
        },
        name: {
          type: "string",
          description: "Nome do artigo (obrigatório se action=create)"
        },
        description: {
          type: "string",
          description: "Descrição do problema/situação (obrigatório se action=create ou update)"
        },
        resolution: {
          type: "string",
          description: "Resolução com verbos no infinitivo (obrigatório se action=create ou update)"
        },
        observations: {
          type: "string",
          description: "Observações adicionais (opcional)"
        },
        createReason: {
          type: "string",
          description: "Motivo da criação do artigo (obrigatório se action=create)"
        },
        updateReason: {
          type: "string",
          description: "Motivo da atualização/melhoria proposta (obrigatório se action=update)"
        },
        confidenceScore: {
          type: "number",
          description: "Nível de confiança de 0 a 100"
        },
        sourceArticles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              similarityScore: { type: "number" }
            }
          },
          description: "Artigos do Zendesk utilizados como fonte com scores de similaridade"
        },
        skipReason: {
          type: "string",
          description: "Motivo para ignorar (obrigatório se action=skip)"
        }
      },
      required: ["action"]
    },
    handler: async (args: any) => {
      return `Sugestão registrada para intenção #${intentWithArticle.intent.id}: action=${args.action}`;
    }
  };
}

function buildUserPromptForIntent(intentWithArticle: IntentWithArticle, config: EnrichmentConfig): string {
  const { intent, article } = intentWithArticle;
  const hasArticle = !!article;
  const hasIntentSynonyms = intent.synonyms && intent.synonyms.length > 0;
  const hasSubjectSynonyms = intent.subjectSynonyms && intent.subjectSynonyms.length > 0;
  
  let prompt = config.promptTemplate || ENRICHMENT_USER_PROMPT_TEMPLATE;
  
  // Track if synonyms were substituted via template placeholders
  let intentSynonymsSubstituted = false;
  let subjectSynonymsSubstituted = false;
  
  prompt = prompt
    .replace(/\{\{intencao_id\}\}/gi, String(intent.id))
    .replace(/\{\{intencao_nome\}\}/gi, intent.name)
    .replace(/\{\{assunto_nome\}\}/gi, intent.subjectName)
    .replace(/\{\{produto\}\}/gi, intent.productName);
  
  if (hasIntentSynonyms) {
    // Check if template contains synonym placeholders before replacing
    if (prompt.includes('{{intencao_sinonimos}}') || prompt.includes('{{#if_intencao_sinonimos}}')) {
      intentSynonymsSubstituted = true;
    }
    prompt = prompt
      .replace(/\{\{#if_intencao_sinonimos\}\}([\s\S]*?)\{\{\/if_intencao_sinonimos\}\}/gi, '$1')
      .replace(/\{\{intencao_sinonimos\}\}/gi, intent.synonyms.join(', '));
  } else {
    prompt = prompt
      .replace(/\{\{#if_intencao_sinonimos\}\}[\s\S]*?\{\{\/if_intencao_sinonimos\}\}/gi, '');
  }
  
  if (hasSubjectSynonyms) {
    // Check if template contains synonym placeholders before replacing
    if (prompt.includes('{{assunto_sinonimos}}') || prompt.includes('{{#if_assunto_sinonimos}}')) {
      subjectSynonymsSubstituted = true;
    }
    prompt = prompt
      .replace(/\{\{#if_assunto_sinonimos\}\}([\s\S]*?)\{\{\/if_assunto_sinonimos\}\}/gi, '$1')
      .replace(/\{\{assunto_sinonimos\}\}/gi, intent.subjectSynonyms.join(', '));
  } else {
    prompt = prompt
      .replace(/\{\{#if_assunto_sinonimos\}\}[\s\S]*?\{\{\/if_assunto_sinonimos\}\}/gi, '');
  }
  
  if (hasArticle) {
    prompt = prompt
      .replace(/\{\{#if_artigo_existe\}\}([\s\S]*?)\{\{\/if_artigo_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_nao_existe\}\}[\s\S]*?\{\{\/if_artigo_nao_existe\}\}/gi, '')
      .replace(/\{\{artigo_id\}\}/gi, String(article.id))
      .replace(/\{\{artigo_nome\}\}/gi, article.name || intent.name)
      .replace(/\{\{descricao\}\}/gi, article.description || "Sem descrição")
      .replace(/\{\{resolucao\}\}/gi, article.resolution || "Sem resolução")
      .replace(/\{\{observacoes\}\}/gi, article.observations || "Sem observações");
  } else {
    prompt = prompt
      .replace(/\{\{#if_artigo_nao_existe\}\}([\s\S]*?)\{\{\/if_artigo_nao_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_existe\}\}[\s\S]*?\{\{\/if_artigo_existe\}\}/gi, '');
  }
  
  // Always append synonyms context if not already substituted via template placeholders
  // This ensures synonyms are ALWAYS included in the prompt regardless of template customization
  const synonymsToAppend = {
    intentSynonyms: (!intentSynonymsSubstituted && hasIntentSynonyms) ? intent.synonyms : [],
    subjectSynonyms: (!subjectSynonymsSubstituted && hasSubjectSynonyms) ? intent.subjectSynonyms : []
  };
  
  const synonymsContext = buildSynonymsContext(synonymsToAppend.intentSynonyms, synonymsToAppend.subjectSynonyms);
  if (synonymsContext) {
    prompt += synonymsContext;
  }
  
  return prompt;
}

function buildSynonymsContext(intentSynonyms: string[], subjectSynonyms: string[]): string {
  const hasIntentSynonyms = intentSynonyms && intentSynonyms.length > 0;
  const hasSubjectSynonyms = subjectSynonyms && subjectSynonyms.length > 0;
  
  if (!hasIntentSynonyms && !hasSubjectSynonyms) {
    return '';
  }
  
  let context = '\n\n---\n\n## Sinônimos para Busca\n\nUse estes termos alternativos na busca do Zendesk para obter resultados mais completos:\n';
  
  if (hasIntentSynonyms) {
    context += `- **Sinônimos da Intenção:** ${intentSynonyms.join(', ')}\n`;
  }
  
  if (hasSubjectSynonyms) {
    context += `- **Sinônimos do Assunto:** ${subjectSynonyms.join(', ')}\n`;
  }
  
  return context;
}

interface ProcessIntentResult {
  success: boolean;
  action?: 'create' | 'update' | 'skip';
  suggestion?: { id: number; type: string; intentId: number; articleId?: number; product?: string };
  newArticleId?: number;
  error?: string;
  openaiLogId?: number;
  outcomeReason?: string;
  confidenceScore?: number;
  sourceArticles?: Array<{ id: string; title: string; similarityScore: number }>;
}

async function processIntent(
  intentWithArticle: IntentWithArticle,
  config: EnrichmentConfig
): Promise<ProcessIntentResult> {
  const { intent, article } = intentWithArticle;
  const userPrompt = buildUserPromptForIntent(intentWithArticle, config);

  const tools: ToolDefinition[] = [
    buildCreateEnrichmentSuggestionTool(intentWithArticle)
  ];

  if (config.useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool();
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      console.log(`[Enrichment Agent] Zendesk KB search for intent #${intent.id}: keywords=${args.keywords}`);
      return originalHandler(args);
    };
    tools.unshift(zendeskTool);
  }

  const result = await callOpenAI({
    requestType: "enrichment_agent",
    modelName: config.modelName,
    promptSystem: config.promptSystem || ENRICHMENT_SYSTEM_PROMPT,
    promptUser: userPrompt,
    tools,
    maxTokens: 4096,
    maxIterations: 5,
    contextType: "enrichment",
    contextId: `enrichment-intent-${intent.id}`,
    finalToolName: "create_enrichment_suggestion"
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || `Failed to process intent #${intent.id}`,
      openaiLogId: result.logId,
      outcomeReason: result.error || `Failed to process intent #${intent.id}`
    };
  }

  if (!result.toolResult) {
    return {
      success: true,
      action: 'skip',
      error: `No suggestion generated for intent #${intent.id}`,
      openaiLogId: result.logId,
      outcomeReason: `No suggestion generated for intent #${intent.id}`
    };
  }

  const suggestionResult = result.toolResult;

  // Validação defensiva: se a action não for válida, trata como skip
  const validActions = ['create', 'update', 'skip'];
  if (!suggestionResult.action || !validActions.includes(suggestionResult.action)) {
    console.log(`[Enrichment Agent] Invalid or missing action for intent #${intent.id}, treating as skip`);
    return {
      success: true,
      action: 'skip',
      openaiLogId: result.logId,
      outcomeReason: suggestionResult.skipReason || `Resposta inválida da OpenAI para intenção #${intent.id}`,
      confidenceScore: suggestionResult.confidenceScore,
      sourceArticles: []
    };
  }

  if (suggestionResult.action === "skip") {
    console.log(`[Enrichment Agent] Skipping intent #${intent.id}: ${suggestionResult.skipReason}`);
    const sourceArticlesData = suggestionResult.sourceArticles?.map((s: ZendeskSourceArticle) => ({
      id: s.id,
      title: s.title,
      similarityScore: s.similarityScore
    })) || [];
    return { 
      success: true, 
      action: 'skip',
      openaiLogId: result.logId,
      outcomeReason: suggestionResult.skipReason || `Sem informação suficiente para criar sugestão para intenção #${intent.id}`,
      confidenceScore: suggestionResult.confidenceScore,
      sourceArticles: sourceArticlesData
    };
  }

  const sourceArticlesData = suggestionResult.sourceArticles?.map((s: ZendeskSourceArticle) => ({
    id: s.id,
    title: s.title,
    similarityScore: s.similarityScore
  })) || [];

  let newArticleId: number | undefined;
  let targetArticleId: number | null = article?.id || null;

  if (suggestionResult.action === "create") {
    const newArticle = await knowledgeBaseStorage.createArticle({
      name: suggestionResult.name || intent.name,
      productStandard: intent.productName,
      subproductStandard: null,
      category1: null,
      category2: null,
      subjectId: intent.subjectId,
      intentId: intent.id,
      intent: intent.name,
      description: suggestionResult.description || "",
      resolution: suggestionResult.resolution || "",
      observations: suggestionResult.observations || null,
    });
    
    newArticleId = newArticle.id;
    targetArticleId = newArticle.id;
    console.log(`[Enrichment Agent] Article created: id=${newArticle.id} for intent #${intent.id}`);
  }

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId: null,
    externalConversationId: null,
    suggestionType: suggestionResult.action,
    name: suggestionResult.name || article?.name || intent.name,
    productStandard: intent.productName,
    subproductStandard: null,
    category1: null,
    category2: null,
    description: suggestionResult.description || article?.description,
    resolution: suggestionResult.resolution || article?.resolution,
    observations: suggestionResult.observations || article?.observations,
    confidenceScore: suggestionResult.confidenceScore,
    similarArticleId: targetArticleId,
    updateReason: suggestionResult.updateReason || suggestionResult.createReason,
    status: "pending",
    conversationHandler: null,
    rawExtraction: {
      ...suggestionResult,
      intentId: intent.id,
      intentName: intent.name,
      subjectName: intent.subjectName,
      productName: intent.productName,
      sourceArticles: sourceArticlesData,
      enrichmentSource: "zendesk",
      newArticleId: newArticleId
    }
  });

  console.log(`[Enrichment Agent] Suggestion saved: id=${suggestion.id} for intent #${intent.id}, action=${suggestionResult.action}`);

  return {
    success: true,
    action: suggestionResult.action,
    newArticleId,
    suggestion: {
      id: suggestion.id,
      type: suggestionResult.action,
      intentId: intent.id,
      articleId: targetArticleId || undefined,
      product: intent.productName
    },
    openaiLogId: result.logId,
    outcomeReason: suggestionResult.updateReason || suggestionResult.createReason,
    confidenceScore: suggestionResult.confidenceScore,
    sourceArticles: sourceArticlesData
  };
}

export async function generateEnrichmentSuggestions(params: EnrichmentParams): Promise<EnrichmentResult> {
  const suggestions: Array<{ id: number; type: string; intentId: number; articleId?: number; product?: string }> = [];
  const errors: string[] = [];
  let articlesCreated = 0;
  let articlesUpdated = 0;
  let skipped = 0;
  
  const triggerRunId = randomUUID();
  console.log(`[Enrichment Agent] Starting batch run: ${triggerRunId} with ${params.intentsWithArticles.length} intents`);

  for (const intentWithArticle of params.intentsWithArticles) {
    const { intent, article } = intentWithArticle;
    
    try {
      console.log(`[Enrichment Agent] Processing intent #${intent.id}: ${intent.name} (hasArticle: ${!!article})`);
      const result = await processIntent(intentWithArticle, params.config);

      const logData: InsertKnowledgeEnrichmentLog = {
        intentId: intent.id,
        articleId: result.newArticleId || article?.id || null,
        action: result.action || 'skip',
        outcomeReason: result.outcomeReason || result.error,
        suggestionId: result.suggestion?.id || null,
        sourceArticles: result.sourceArticles || null,
        confidenceScore: result.confidenceScore || null,
        productStandard: intent.productName,
        outcomePayload: result.suggestion ? {
          suggestionId: result.suggestion.id,
          suggestionType: result.suggestion.type,
          articleId: result.suggestion.articleId,
          newArticleId: result.newArticleId
        } : null,
        openaiLogId: result.openaiLogId || null,
        triggerRunId,
        processedAt: new Date()
      };

      await enrichmentLogStorage.create(logData);
      console.log(`[Enrichment Agent] Log saved for intent #${intent.id}: action=${result.action}`);

      if (!result.success) {
        errors.push(result.error || `Error processing intent #${intent.id}`);
        skipped++;
      } else if (result.action === 'skip') {
        skipped++;
      } else if (result.action === 'create') {
        articlesCreated++;
        if (result.suggestion) {
          suggestions.push(result.suggestion);
        }
      } else if (result.action === 'update') {
        articlesUpdated++;
        if (result.suggestion) {
          suggestions.push(result.suggestion);
        }
      }
    } catch (error: any) {
      console.error(`[Enrichment Agent] Error processing intent #${intent.id}:`, error.message);
      errors.push(`Intent #${intent.id}: ${error.message}`);
      skipped++;
      
      const errorLogData: InsertKnowledgeEnrichmentLog = {
        intentId: intent.id,
        articleId: article?.id || null,
        action: 'skip',
        outcomeReason: `Processing error: ${error.message}`,
        suggestionId: null,
        sourceArticles: null,
        confidenceScore: null,
        productStandard: intent.productName,
        outcomePayload: { error: error.message },
        openaiLogId: null,
        triggerRunId,
        processedAt: new Date()
      };
      
      try {
        await enrichmentLogStorage.create(errorLogData);
        console.log(`[Enrichment Agent] Error log saved for intent #${intent.id}: action=skip`);
      } catch (logError: any) {
        console.error(`[Enrichment Agent] Failed to save error log for intent #${intent.id}:`, logError.message);
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
