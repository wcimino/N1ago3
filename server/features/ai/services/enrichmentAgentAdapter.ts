import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { createZendeskKnowledgeBaseTool } from "./aiTools.js";
import { ENRICHMENT_SYSTEM_PROMPT, ENRICHMENT_USER_PROMPT_TEMPLATE } from "../constants/enrichmentAgentPrompts.js";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";

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
  articles: KnowledgeBaseArticle[];
  config: EnrichmentConfig;
}

export interface EnrichmentResult {
  success: boolean;
  suggestionsGenerated: number;
  articlesProcessed: number;
  suggestions?: Array<{
    id: number;
    type: string;
    localArticleId: number;
    product?: string;
    subproduct?: string;
  }>;
  errors?: string[];
}

interface ZendeskSourceArticle {
  id: string;
  title: string;
  similarityScore: number;
}

function buildCreateEnrichmentSuggestionTool(localArticle: KnowledgeBaseArticle): ToolDefinition {
  return {
    name: "create_enrichment_suggestion",
    description: "Registra uma sugestão de melhoria para o artigo local baseada na comparação com artigos do Zendesk.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["update", "skip"],
          description: "Ação a tomar: update (melhorar o artigo existente), skip (ignorar pois não há melhoria)"
        },
        improvedDescription: {
          type: "string",
          description: "Descrição melhorada do problema/situação (se action=update)"
        },
        improvedResolution: {
          type: "string",
          description: "Resolução melhorada/complementada (se action=update)"
        },
        additionalObservations: {
          type: "string",
          description: "Observações adicionais encontradas no Zendesk (se action=update)"
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
      return `Sugestão registrada para artigo #${localArticle.id}: action=${args.action}`;
    }
  };
}

function buildUserPromptForArticle(article: KnowledgeBaseArticle, config: EnrichmentConfig): string {
  const basePrompt = config.promptTemplate || ENRICHMENT_USER_PROMPT_TEMPLATE;
  return basePrompt
    .replace(/\{\{artigo_id\}\}/gi, String(article.id))
    .replace(/\{\{artigo_nome\}\}/gi, article.name || "Sem nome")
    .replace(/\{\{produto\}\}/gi, article.productStandard || "N/A")
    .replace(/\{\{subproduto\}\}/gi, article.subproductStandard || "N/A")
    .replace(/\{\{categoria1\}\}/gi, article.category1 || "N/A")
    .replace(/\{\{categoria2\}\}/gi, article.category2 || "N/A")
    .replace(/\{\{intencao\}\}/gi, article.intent || "N/A")
    .replace(/\{\{descricao\}\}/gi, article.description || "Sem descrição")
    .replace(/\{\{resolucao\}\}/gi, article.resolution || "Sem resolução")
    .replace(/\{\{observacoes\}\}/gi, article.observations || "Sem observações");
}

async function processArticle(
  article: KnowledgeBaseArticle,
  config: EnrichmentConfig
): Promise<{
  success: boolean;
  suggestion?: { id: number; type: string; localArticleId: number; product?: string; subproduct?: string };
  error?: string;
}> {
  const userPrompt = buildUserPromptForArticle(article, config);

  const tools: ToolDefinition[] = [
    buildCreateEnrichmentSuggestionTool(article)
  ];

  if (config.useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool();
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      console.log(`[Enrichment Agent] Zendesk KB search for article #${article.id}: keywords=${args.keywords}`);
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
    contextId: `enrichment-article-${article.id}`,
    finalToolName: "create_enrichment_suggestion"
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || `Failed to process article #${article.id}`
    };
  }

  if (!result.toolResult) {
    return {
      success: true,
      error: `No suggestion generated for article #${article.id}`
    };
  }

  const suggestionResult = result.toolResult;

  if (suggestionResult.action === "skip") {
    console.log(`[Enrichment Agent] Skipping article #${article.id}: ${suggestionResult.skipReason}`);
    return { success: true };
  }

  const sourceArticlesData = suggestionResult.sourceArticles?.map((s: ZendeskSourceArticle) => ({
    id: s.id,
    title: s.title,
    similarityScore: s.similarityScore
  })) || [];

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId: null,
    externalConversationId: null,
    suggestionType: "update",
    name: article.name,
    productStandard: article.productStandard,
    subproductStandard: article.subproductStandard,
    category1: article.category1,
    category2: article.category2,
    description: suggestionResult.improvedDescription || article.description,
    resolution: suggestionResult.improvedResolution || article.resolution,
    observations: suggestionResult.additionalObservations || article.observations,
    confidenceScore: suggestionResult.confidenceScore,
    similarArticleId: article.id,
    updateReason: suggestionResult.updateReason,
    status: "pending",
    conversationHandler: null,
    rawExtraction: {
      ...suggestionResult,
      localArticleId: article.id,
      sourceArticles: sourceArticlesData,
      enrichmentSource: "zendesk"
    }
  });

  console.log(`[Enrichment Agent] Suggestion saved: id=${suggestion.id} for article #${article.id}`);

  return {
    success: true,
    suggestion: {
      id: suggestion.id,
      type: "update",
      localArticleId: article.id,
      product: article.productStandard || undefined,
      subproduct: article.subproductStandard || undefined
    }
  };
}

export async function generateEnrichmentSuggestions(params: EnrichmentParams): Promise<EnrichmentResult> {
  const suggestions: Array<{ id: number; type: string; localArticleId: number; product?: string; subproduct?: string }> = [];
  const errors: string[] = [];

  for (const article of params.articles) {
    try {
      console.log(`[Enrichment Agent] Processing article #${article.id}: ${article.name}`);
      const result = await processArticle(article, params.config);

      if (!result.success) {
        errors.push(result.error || `Error processing article #${article.id}`);
      } else if (result.suggestion) {
        suggestions.push(result.suggestion);
      }
    } catch (error: any) {
      console.error(`[Enrichment Agent] Error processing article #${article.id}:`, error.message);
      errors.push(`Article #${article.id}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    suggestionsGenerated: suggestions.length,
    articlesProcessed: params.articles.length,
    suggestions,
    errors: errors.length > 0 ? errors : undefined
  };
}
