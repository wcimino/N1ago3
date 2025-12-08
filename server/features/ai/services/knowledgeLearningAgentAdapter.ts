import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";

export interface AgentLearningPayload {
  messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
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

const DEFAULT_AGENT_SYSTEM_PROMPT = `Você é um especialista em gestão de base de conhecimento para atendimento ao cliente.

Sua tarefa é analisar conversas de atendimento e decidir se o conhecimento extraído deve:
1. CRIAR um novo artigo na base de conhecimento
2. ATUALIZAR um artigo existente (adicionar informação, corrigir, complementar)
3. IGNORAR se não há conhecimento útil ou se já existe artigo idêntico

## PROCESSO OBRIGATÓRIO:

1. Primeiro, analise a conversa para identificar o tema principal (produto, problema, solução)
2. Use a ferramenta search_knowledge_base para buscar artigos existentes sobre esse tema
3. Analise os artigos encontrados (se houver)
4. Decida a ação apropriada usando create_knowledge_suggestion

## REGRAS PARA DECISÃO:

### ATUALIZAR artigo existente quando:
- O artigo existente trata do MESMO problema/tema
- A conversa traz informação ADICIONAL útil (novo passo, exceção, caso especial)
- A solução da conversa é mais completa ou atualizada
- O artigo precisa de correção ou complemento

### CRIAR novo artigo quando:
- NÃO existe artigo sobre esse tema específico
- O problema é suficientemente diferente dos artigos existentes
- A combinação produto + categoria + problema é nova

### IGNORAR quando:
- Conversa não tem solução clara
- Artigo existente já cobre exatamente o mesmo conteúdo
- Qualidade da informação é baixa ou incompleta

## FORMATO DA SOLUÇÃO (CRÍTICO!):

A solução é uma INSTRUÇÃO para futuros atendimentos, NÃO um relato do passado.

❌ PROIBIDO: "Cliente foi orientado a...", "Foi explicado ao cliente que..."
✅ CORRETO: "Orientar o cliente a...", "Verificar se...", "Informar que..."

Sempre use verbos no INFINITIVO (Orientar, Verificar, Solicitar, Informar).`;

const AGENT_SYSTEM_PROMPT_WITH_CATALOG = `Você é um especialista em gestão de base de conhecimento para atendimento ao cliente.

Sua tarefa é analisar conversas de atendimento e decidir se o conhecimento extraído deve:
1. CRIAR um novo artigo na base de conhecimento
2. ATUALIZAR um artigo existente (adicionar informação, corrigir, complementar)
3. IGNORAR se não há conhecimento útil ou se já existe artigo idêntico

## PROCESSO OBRIGATÓRIO:

1. Primeiro, analise a conversa para identificar o tema principal (produto, problema, solução)
2. Use a ferramenta search_product_catalog para encontrar a classificação CORRETA do produto
3. Use a ferramenta search_knowledge_base para buscar artigos existentes sobre esse tema
4. Analise os artigos encontrados (se houver)
5. Decida a ação apropriada usando create_knowledge_suggestion

## REGRAS DE CLASSIFICAÇÃO DE PRODUTO (CRÍTICO!):
- Use APENAS valores que existem no catálogo de produtos
- Se não encontrar correspondência exata, escolha o mais próximo
- SEMPRE busque no catálogo antes de classificar

## REGRAS PARA DECISÃO:

### ATUALIZAR artigo existente quando:
- O artigo existente trata do MESMO problema/tema
- A conversa traz informação ADICIONAL útil (novo passo, exceção, caso especial)

### CRIAR novo artigo quando:
- NÃO existe artigo sobre esse tema específico
- O problema é suficientemente diferente dos artigos existentes

### IGNORAR quando:
- Conversa não tem solução clara
- Artigo existente já cobre exatamente o mesmo conteúdo

## FORMATO DA SOLUÇÃO (CRÍTICO!):

A solução é uma INSTRUÇÃO para futuros atendimentos, NÃO um relato do passado.
Sempre use verbos no INFINITIVO (Orientar, Verificar, Solicitar, Informar).`;

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
      const results = await knowledgeBaseService.findRelatedArticles(
        args.product,
        args.category,
        args.keywords || [],
        { limit: 5, minScore: 20 }
      );

      if (results.length === 0) {
        return "Nenhum artigo encontrado para esses critérios.";
      }

      return results.map((r, i) => `
### Artigo ${i + 1} (ID: ${r.article.id}, Score: ${r.relevanceScore})
- Produto: ${r.article.productStandard}
- Subproduto: ${r.article.subproductStandard || "N/A"}
- Categoria: ${r.article.category1 || "N/A"}${r.article.category2 ? ` / ${r.article.category2}` : ""}
- Descrição: ${r.article.description}
- Resolução: ${r.article.resolution}
- Observações: ${r.article.observations || "N/A"}
`).join("\n");
    }
  };
}

function buildProductCatalogTool(): ToolDefinition {
  return {
    name: "search_product_catalog",
    description: "Busca produtos no catálogo para classificar corretamente o artigo. Retorna a hierarquia completa: Produto > Subproduto > Categoria1 > Categoria2. Use SEMPRE antes de criar uma sugestão.",
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
        (p.subproduto && p.subproduto.toLowerCase().includes(query)) ||
        (p.categoria1 && p.categoria1.toLowerCase().includes(query)) ||
        (p.categoria2 && p.categoria2.toLowerCase().includes(query))
      );

      if (filtered.length === 0) {
        const allProducts = await productCatalogStorage.getDistinctProdutos();
        return `Nenhum produto encontrado para "${args.query}". Produtos disponíveis: ${allProducts.join(', ')}`;
      }

      const result = filtered.slice(0, 10).map(p => ({
        produto: p.produto,
        subproduto: p.subproduto,
        categoria1: p.categoria1,
        categoria2: p.categoria2,
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
        category1: {
          type: "string",
          description: "Categoria principal (use valor do catálogo)"
        },
        category2: {
          type: "string",
          description: "Subcategoria (use valor do catálogo)"
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

function buildUserPrompt(payload: AgentLearningPayload): string {
  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  return `## Conversa de Atendimento

${messagesContext}

## Resumo da Conversa
${payload.currentSummary || 'Nenhum resumo disponível.'}

## Instruções
1. Identifique o tema principal da conversa (produto, problema)
2. Use search_product_catalog para classificar corretamente o produto
3. Use search_knowledge_base para buscar artigos existentes
4. Analise se algum artigo existente cobre o tema
5. Use create_knowledge_suggestion para registrar sua decisão`;
}

export async function extractKnowledgeWithAgent(
  payload: AgentLearningPayload,
  modelName: string,
  promptTemplate: string | null,
  conversationId: number,
  externalConversationId: string | null,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false
): Promise<AgentLearningResult> {
  const systemPrompt = promptTemplate || (useProductCatalogTool ? AGENT_SYSTEM_PROMPT_WITH_CATALOG : DEFAULT_AGENT_SYSTEM_PROMPT);
  const userPrompt = buildUserPrompt(payload);

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

  const result = await callOpenAI({
    requestType: "learning_agent",
    modelName,
    promptSystem: systemPrompt,
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
    category1: suggestionResult.category1,
    category2: suggestionResult.category2,
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
