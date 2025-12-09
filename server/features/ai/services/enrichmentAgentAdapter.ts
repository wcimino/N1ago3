import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { createZendeskKnowledgeBaseTool } from "./aiTools.js";
import { ENRICHMENT_SYSTEM_PROMPT, ENRICHMENT_USER_PROMPT_TEMPLATE } from "../constants/enrichmentAgentPrompts.js";

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
  product?: string;
  subproduct?: string;
  config: EnrichmentConfig;
}

export interface EnrichmentResult {
  success: boolean;
  suggestionsGenerated: number;
  suggestions?: Array<{
    id: number;
    type: string;
    product?: string;
    subproduct?: string;
  }>;
  error?: string;
  logId?: number;
}

interface ZendeskSourceArticle {
  id: string;
  title: string;
  similarityScore: number;
}

function buildLocalKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_local_knowledge_base",
    description: "Busca artigos existentes na base de conhecimento interna. Use para verificar se já existe informação sobre o tema antes de decidir criar ou atualizar.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Produto para filtrar (ex: Antecipação, Repasse, Conta Digital)"
        },
        subproduct: {
          type: "string",
          description: "Subproduto para filtrar"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Palavras-chave para busca textual"
        }
      },
      required: []
    },
    handler: async (args: { product?: string; subproduct?: string; keywords?: string[] }) => {
      const articles = await knowledgeBaseStorage.getAllArticles({
        productStandard: args.product,
        subproductStandard: args.subproduct
      });

      if (articles.length === 0) {
        return "Nenhum artigo encontrado na base local com esses critérios.";
      }

      const filtered = args.keywords && args.keywords.length > 0
        ? articles.filter(a => {
            const text = `${a.description} ${a.resolution} ${a.observations || ""}`.toLowerCase();
            return args.keywords!.some(k => text.includes(k.toLowerCase()));
          })
        : articles;

      if (filtered.length === 0) {
        return "Nenhum artigo encontrado com essas palavras-chave.";
      }

      return filtered.slice(0, 10).map((a, i) => `
### Artigo Local ${i + 1} (ID: ${a.id})
- Produto: ${a.productStandard}
- Subproduto: ${a.subproductStandard || "N/A"}
- Descrição: ${a.description}
- Resolução: ${a.resolution}
`).join("\n");
    }
  };
}

function buildCreateEnrichmentSuggestionTool(): ToolDefinition {
  return {
    name: "create_enrichment_suggestion",
    description: "Cria uma sugestão de melhoria para a base de conhecimento baseada na comparação com artigos do Zendesk.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "skip"],
          description: "Ação a tomar: create (novo artigo), update (atualizar existente), skip (ignorar)"
        },
        targetArticleId: {
          type: "number",
          description: "ID do artigo local a atualizar (obrigatório se action=update)"
        },
        updateReason: {
          type: "string",
          description: "Motivo da atualização (obrigatório se action=update)"
        },
        name: {
          type: "string",
          description: "Nome curto e descritivo do artigo"
        },
        productStandard: {
          type: "string",
          description: "Produto principal"
        },
        subproductStandard: {
          type: "string",
          description: "Subproduto específico"
        },
        description: {
          type: "string",
          description: "Descrição do problema/situação"
        },
        resolution: {
          type: "string",
          description: "Solução detalhada"
        },
        observations: {
          type: "string",
          description: "Observações adicionais"
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
      return `Sugestão registrada: action=${args.action}`;
    }
  };
}

function buildUserPrompt(params: EnrichmentParams): string {
  const basePrompt = params.config.promptTemplate || ENRICHMENT_USER_PROMPT_TEMPLATE;
  return basePrompt
    .replace(/\{\{produto\}\}/gi, params.product || "Todos")
    .replace(/\{\{subproduto\}\}/gi, params.subproduct || "Todos");
}

export async function generateEnrichmentSuggestions(params: EnrichmentParams): Promise<EnrichmentResult> {
  const userPrompt = buildUserPrompt(params);

  const tools: ToolDefinition[] = [
    buildCreateEnrichmentSuggestionTool()
  ];

  if (params.config.useKnowledgeBaseTool) {
    tools.unshift(buildLocalKnowledgeBaseTool());
  }

  if (params.config.useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool();
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      console.log(`[Enrichment Agent] Zendesk KB search: keywords=${args.keywords}`);
      return originalHandler(args);
    };
    tools.unshift(zendeskTool);
  }

  const result = await callOpenAI({
    requestType: "enrichment_agent",
    modelName: params.config.modelName,
    promptSystem: params.config.promptSystem || ENRICHMENT_SYSTEM_PROMPT,
    promptUser: userPrompt,
    tools,
    maxTokens: 4096,
    maxIterations: 10,
    contextType: "enrichment",
    contextId: `enrichment-${Date.now()}`,
    finalToolName: "create_enrichment_suggestion"
  });

  if (!result.success) {
    return {
      success: false,
      suggestionsGenerated: 0,
      error: result.error || "Agent failed to generate suggestions",
      logId: result.logId
    };
  }

  const suggestions: Array<{ id: number; type: string; product?: string; subproduct?: string }> = [];

  if (result.toolResult) {
    const suggestionResult = result.toolResult;
    
    if (suggestionResult.action === "skip") {
      console.log(`[Enrichment Agent] Skipping: ${suggestionResult.skipReason}`);
    } else {
      const sourceArticlesData = suggestionResult.sourceArticles?.map((s: ZendeskSourceArticle) => ({
        id: s.id,
        title: s.title,
        similarityScore: s.similarityScore
      })) || [];

      const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
        conversationId: null,
        externalConversationId: null,
        suggestionType: suggestionResult.action,
        name: suggestionResult.name,
        productStandard: suggestionResult.productStandard || params.product,
        subproductStandard: suggestionResult.subproductStandard || params.subproduct,
        category1: null,
        category2: null,
        description: suggestionResult.description,
        resolution: suggestionResult.resolution,
        observations: suggestionResult.observations,
        confidenceScore: suggestionResult.confidenceScore,
        similarArticleId: suggestionResult.targetArticleId,
        updateReason: suggestionResult.updateReason,
        status: "pending",
        conversationHandler: null,
        rawExtraction: {
          ...suggestionResult,
          sourceArticles: sourceArticlesData,
          enrichmentSource: "zendesk"
        }
      });

      suggestions.push({
        id: suggestion.id,
        type: suggestionResult.action,
        product: suggestionResult.productStandard,
        subproduct: suggestionResult.subproductStandard
      });

      console.log(`[Enrichment Agent] Suggestion saved: id=${suggestion.id}, type=${suggestionResult.action}`);
    }
  }

  return {
    success: true,
    suggestionsGenerated: suggestions.length,
    suggestions,
    logId: result.logId
  };
}
