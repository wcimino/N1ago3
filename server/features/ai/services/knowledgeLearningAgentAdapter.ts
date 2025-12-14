import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { runKnowledgeBaseSearch } from "./knowledgeBaseSearchHelper.js";
import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { createZendeskKnowledgeBaseTool } from "./aiTools.js";
import { replacePromptVariables, formatMessagesContext, type ContentPayload } from "./promptUtils.js";

export interface AgentLearningPayload {
  messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  }>;
  currentSummary: string | null;
  conversationHandler: string | null;
}

export interface AgentLearningResult {
  success: boolean;
  suggestionId?: number;
  suggestionType?: "create" | "update" | "skip";
  targetArticleId?: number;
  usedProductCatalog?: boolean;
  error?: string;
  logId?: number;
}

function buildSearchKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_knowledge_base",
    description: "Busca artigos existentes na base de conhecimento. Use para verificar se já existe informação sobre o tema antes de decidir criar ou atualizar.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Produto principal (ex: Antecipação, Repasse, Conta Digital, Cartão, Pix)"
        },
        category: {
          type: "string",
          description: "Categoria do problema (ex: Consulta, Solicitação, Reclamação, Cancelamento)"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Palavras-chave relevantes para busca (ex: ['prazo', 'valores', 'documentos'])"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; category?: string; keywords?: string[] }) => {
      const resolved = await productCatalogStorage.resolveProductId(args.product);
      
      const result = await runKnowledgeBaseSearch({
        productId: resolved?.id,
        keywords: args.keywords,
        limit: 5
      });

      if (result.articles.length === 0) {
        return "Nenhum artigo encontrado para esses critérios.";
      }

      return result.articles.map((a, i) => `
### Artigo ${i + 1} (ID: ${a.id}, Score: ${Math.round(a.relevanceScore * 100)})
- Produto: ${a.productStandard}
- Subproduto: ${a.subproductStandard || "N/A"}
- Descrição: ${a.description}
- Resolução: ${a.resolution}
- Observações: ${a.observations || "N/A"}
`).join("\n");
    }
  };
}

function buildProductCatalogTool(): ToolDefinition {
  return {
    name: "search_product_catalog",
    description: "Busca produtos no catálogo para classificar corretamente o artigo. Retorna a hierarquia: Produto > Subproduto. Use SEMPRE antes de criar uma sugestão.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca para encontrar o produto (ex: 'antecipação', 'cartão', 'repasse')"
        }
      },
      required: ["query"]
    },
    handler: async (args: { query: string }) => {
      const products = await productCatalogStorage.getAll();
      
      const query = args.query.toLowerCase();
      const filtered = products.filter(p => 
        p.fullName.toLowerCase().includes(query) ||
        p.produto.toLowerCase().includes(query) ||
        (p.subproduto && p.subproduto.toLowerCase().includes(query))
      );

      if (filtered.length === 0) {
        const allProducts = await productCatalogStorage.getDistinctProdutos();
        return `Nenhum produto encontrado para "${args.query}". Produtos disponíveis: ${allProducts.join(', ')}`;
      }

      const result = filtered.slice(0, 10).map(p => ({
        produto: p.produto,
        subproduto: p.subproduto,
        fullName: p.fullName
      }));

      return `Produtos encontrados:\n${JSON.stringify(result, null, 2)}`;
    }
  };
}

function buildCreateSuggestionTool(): ToolDefinition {
  return {
    name: "create_knowledge_suggestion",
    description: "Cria uma sugestão de conhecimento. Use após analisar os artigos existentes e buscar no catálogo de produtos.",
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
          description: "ID do artigo a atualizar (obrigatório se action=update)"
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
          description: "Produto principal (use valor do catálogo)"
        },
        subproductStandard: {
          type: "string",
          description: "Subproduto específico (use valor do catálogo)"
        },
        description: {
          type: "string",
          description: "Descrição do problema/situação"
        },
        resolution: {
          type: "string",
          description: "Solução detalhada com passos específicos. Use verbos no infinitivo."
        },
        observations: {
          type: "string",
          description: "Observações adicionais, exceções, casos especiais"
        },
        confidenceScore: {
          type: "number",
          description: "Nível de confiança de 0 a 100"
        },
        skipReason: {
          type: "string",
          description: "Motivo para ignorar (obrigatório se action=skip)"
        }
      },
      required: ["action"]
    },
    handler: async (args: any) => {
      return `Sugestão registrada: action=${args.action}${args.targetArticleId ? `, targetArticleId=${args.targetArticleId}` : ''}`;
    }
  };
}

function buildUserPrompt(payload: AgentLearningPayload, promptTemplate: string, responseFormat: string | null): string {
  const messagesContext = formatMessagesContext(payload.messages);
  
  const variables = {
    resumo: payload.currentSummary,
    resumoAtual: payload.currentSummary,
    mensagens: messagesContext,
    ultimas20Mensagens: messagesContext,
    handler: payload.conversationHandler,
  };
  
  const promptWithVars = replacePromptVariables(promptTemplate, variables);
  
  let fullPrompt = promptWithVars;
  if (responseFormat) {
    fullPrompt += `\n\n## Formato da Resposta\n${responseFormat}`;
  }
  
  return fullPrompt;
}

export async function extractKnowledgeWithAgent(
  payload: AgentLearningPayload,
  modelName: string,
  promptTemplate: string | null,
  promptSystem: string | null,
  responseFormat: string | null,
  conversationId: number,
  externalConversationId: string | null,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useZendeskKnowledgeBaseTool: boolean = false
): Promise<AgentLearningResult> {
  if (!promptTemplate || !promptTemplate.trim()) {
    throw new Error("Learning agent prompt template is required. Please configure it in the database.");
  }

  const userPrompt = buildUserPrompt(payload, promptTemplate, responseFormat);
  const effectivePromptSystem = promptSystem || "Você é um especialista em gestão de base de conhecimento para atendimento ao cliente.";

  const tools: ToolDefinition[] = [
    buildSearchKnowledgeBaseTool(),
    buildCreateSuggestionTool()
  ];

  let usedProductCatalog = false;
  
  if (useProductCatalogTool) {
    const catalogTool = buildProductCatalogTool();
    const originalHandler = catalogTool.handler;
    catalogTool.handler = async (args) => {
      usedProductCatalog = true;
      console.log(`[Learning Agent] Catalog search: query=${args.query}`);
      return originalHandler(args);
    };
    tools.unshift(catalogTool);
  }

  if (useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool();
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      console.log(`[Learning Agent] Zendesk KB search: keywords=${args.keywords}`);
      return originalHandler(args);
    };
    tools.push(zendeskTool);
  }

  const result = await callOpenAI({
    requestType: "learning_agent",
    modelName,
    promptSystem: effectivePromptSystem,
    promptUser: userPrompt,
    tools,
    maxTokens: 2048,
    maxIterations: 5,
    contextType: "conversation",
    contextId: externalConversationId || String(conversationId),
    finalToolName: "create_knowledge_suggestion"
  });

  if (!result.success || !result.toolResult) {
    return {
      success: false,
      error: result.error || "Agent did not produce a suggestion",
      usedProductCatalog,
      logId: result.logId
    };
  }

  const suggestionResult = result.toolResult;

  if (suggestionResult.action === "skip") {
    console.log(`[Learning Agent] Skipping conversation ${conversationId}: ${suggestionResult.skipReason}`);
    return {
      success: true,
      suggestionType: "skip",
      usedProductCatalog,
      logId: result.logId
    };
  }

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId,
    externalConversationId,
    suggestionType: suggestionResult.action,
    name: suggestionResult.name,
    productStandard: suggestionResult.productStandard,
    subproductStandard: suggestionResult.subproductStandard,
    description: suggestionResult.description,
    resolution: suggestionResult.resolution,
    observations: suggestionResult.observations,
    confidenceScore: suggestionResult.confidenceScore,
    similarArticleId: suggestionResult.targetArticleId,
    updateReason: suggestionResult.updateReason,
    status: "pending",
    conversationHandler: payload.conversationHandler,
    rawExtraction: suggestionResult
  });

  console.log(`[Learning Agent] Suggestion saved: id=${suggestion.id}, type=${suggestionResult.action}, usedCatalog=${usedProductCatalog}, targetArticle=${suggestionResult.targetArticleId || 'N/A'}`);

  return {
    success: true,
    suggestionId: suggestion.id,
    suggestionType: suggestionResult.action,
    targetArticleId: suggestionResult.targetArticleId,
    usedProductCatalog,
    logId: result.logId
  };
}
