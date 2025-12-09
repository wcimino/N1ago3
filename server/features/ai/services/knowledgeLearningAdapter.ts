import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";

export interface LearningPayload {
  messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  currentSummary: string | null;
  conversationHandler: string | null;
  relatedArticles?: string | null;
}

export interface ExtractedKnowledge {
  productStandard: string | null;
  subproductStandard: string | null;
  description: string | null;
  resolution: string | null;
  observations: string | null;
  confidenceScore: number;
  qualityFlags: {
    isComplete: boolean;
    isUncertain: boolean;
    possibleError: boolean;
    needsReview: boolean;
  };
}

export interface LearningResult {
  success: boolean;
  extraction: ExtractedKnowledge | null;
  logId: number;
  suggestionId?: number;
  similarArticleId?: number;
  similarityScore?: number;
  usedProductCatalog?: boolean;
  error?: string;
}

const PROMPT_SYSTEM = `Você é um especialista em criar artigos de base de conhecimento a partir de conversas de atendimento ao cliente.
Responda sempre em JSON válido.`;

const PROMPT_SYSTEM_WITH_CATALOG = `Você é um especialista em criar artigos de base de conhecimento a partir de conversas de atendimento ao cliente.

## PROCESSO OBRIGATÓRIO:
1. Analise a conversa e identifique o tema/problema
2. Use a ferramenta search_product_catalog para encontrar a classificação correta de produto
3. Retorne o artigo usando EXATAMENTE os valores do catálogo

## REGRAS DE CLASSIFICAÇÃO:
- Use APENAS valores que existem no catálogo de produtos
- Se não encontrar correspondência exata, escolha o mais próximo
- Se realmente não houver correspondência, use null

Responda sempre em JSON válido.`;

const DEFAULT_PROMPT = `## REGRAS IMPORTANTES:

### 1. UM ASSUNTO POR ARTIGO
- Cada artigo deve tratar de APENAS UM tema/problema específico
- Se a conversa menciona múltiplos assuntos, escolha o PRINCIPAL que foi resolvido
- NÃO misture temas diferentes no mesmo artigo

### 2. SOLUÇÃO COMO INSTRUÇÃO FUTURA (CRÍTICO!)
A solução é uma INSTRUÇÃO para futuros atendimentos. NÃO é um relato do que aconteceu na conversa.

REGRA DE OURO: NUNCA use verbos no passado. SEMPRE use INFINITIVO ou IMPERATIVO.

❌ PROIBIDO (narrativa do passado):
- "Cliente foi orientado a..." → ERRADO
- "Foi explicado ao cliente que..." → ERRADO

✅ CORRETO (instrução para o futuro):
- "Orientar o cliente a..." → CERTO
- "Explicar ao cliente que..." → CERTO

### 3. QUALIDADE:
- isComplete = false: se a solução for genérica
- isUncertain = true: se não conseguir extrair detalhes específicos
- possibleError = true: se a orientação parecer incorreta
- needsReview = true: se faltar informação importante

Retorne APENAS um JSON válido:
{
  "productStandard": "produto principal",
  "subproductStandard": "subproduto ou null",
  "description": "descrição do problema",
  "resolution": "PASSO A PASSO com instruções específicas",
  "observations": "exceções ou detalhes adicionais",
  "confidenceScore": 0-100,
  "qualityFlags": {
    "isComplete": true/false,
    "isUncertain": true/false,
    "possibleError": true/false,
    "needsReview": true/false
  }
}

CONVERSA:
{{MENSAGENS}}

RESUMO DA CONVERSA:
{{RESUMO}}

ARTIGOS RELACIONADOS NA BASE DE CONHECIMENTO:
{{ARTIGOS_RELACIONADOS}}`;

function buildProductCatalogTool(): ToolDefinition {
  return {
    name: "search_product_catalog",
    description: "Busca produtos no catálogo para classificar corretamente o artigo. Retorna a hierarquia: Produto > Subproduto",
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

export async function extractKnowledge(
  payload: LearningPayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useProductCatalogTool: boolean = false
): Promise<LearningResult> {
  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const promptUser = (promptTemplate || DEFAULT_PROMPT)
    .replace('{{MENSAGENS}}', messagesContext || 'Nenhuma mensagem.')
    .replace('{{RESUMO}}', payload.currentSummary || 'Nenhum resumo disponível.')
    .replace('{{ARTIGOS_RELACIONADOS}}', payload.relatedArticles || 'Nenhum artigo relacionado encontrado.');

  const tools: ToolDefinition[] = [];
  let usedProductCatalog = false;

  if (useProductCatalogTool) {
    const catalogTool = buildProductCatalogTool();
    const originalHandler = catalogTool.handler;
    catalogTool.handler = async (args) => {
      usedProductCatalog = true;
      console.log(`[Learning Adapter] Catalog search: query=${args.query}`);
      return originalHandler(args);
    };
    tools.push(catalogTool);
  }

  const promptSystem = useProductCatalogTool ? PROMPT_SYSTEM_WITH_CATALOG : PROMPT_SYSTEM;

  const result = await callOpenAI({
    requestType: "learning",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 2048,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    tools: tools.length > 0 ? tools : undefined,
    maxIterations: 3,
  });

  if (!result.success || !result.responseContent) {
    return {
      success: false,
      extraction: null,
      logId: result.logId,
      usedProductCatalog,
      error: result.error || "OpenAI returned empty response"
    };
  }

  try {
    let jsonContent = result.responseContent;
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    const extraction: ExtractedKnowledge = JSON.parse(jsonContent);
    
    return {
      success: true,
      extraction,
      logId: result.logId,
      usedProductCatalog
    };
  } catch (parseError) {
    console.error("[Learning Adapter] Failed to parse extraction response:", parseError);
    return {
      success: false,
      extraction: null,
      logId: result.logId,
      usedProductCatalog,
      error: `Failed to parse response: ${parseError}`
    };
  }
}

async function findSimilarArticle(extraction: ExtractedKnowledge): Promise<{ articleId: number; score: number } | null> {
  if (!extraction.productStandard && !extraction.description) return null;

  const descriptionKeywords = extraction.description
    ?.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3) || [];

  const results = await knowledgeBaseService.findRelatedArticles(
    extraction.productStandard || undefined,
    undefined,
    descriptionKeywords,
    { limit: 1, minScore: 40 }
  );

  if (results.length === 0) return null;

  const bestMatch = results[0];
  return {
    articleId: bestMatch.article.id,
    score: bestMatch.relevanceScore
  };
}

export async function extractAndSaveKnowledge(
  payload: LearningPayload,
  promptTemplate: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  useProductCatalogTool: boolean = false
): Promise<LearningResult> {
  const result = await extractKnowledge(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined,
    useProductCatalogTool
  );

  if (!result.success || !result.extraction) {
    return result;
  }

  const extraction = result.extraction;

  if (!extraction.description && !extraction.resolution) {
    console.log(`[Learning Adapter] Skipping save - no meaningful content extracted for conversation ${conversationId}`);
    return {
      ...result,
      error: "No meaningful content extracted"
    };
  }

  const similarArticle = await findSimilarArticle(extraction);

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId,
    externalConversationId,
    productStandard: extraction.productStandard,
    subproductStandard: extraction.subproductStandard,
    description: extraction.description,
    resolution: extraction.resolution,
    observations: extraction.observations,
    confidenceScore: extraction.confidenceScore,
    qualityFlags: extraction.qualityFlags,
    similarArticleId: similarArticle?.articleId,
    similarityScore: similarArticle?.score,
    status: "pending",
    conversationHandler: payload.conversationHandler,
    rawExtraction: result.extraction,
  });

  console.log(`[Learning Adapter] Knowledge suggestion saved for conversation ${conversationId}, suggestionId: ${suggestion.id}, confidence: ${extraction.confidenceScore}, usedCatalog: ${result.usedProductCatalog}`);

  return {
    ...result,
    suggestionId: suggestion.id,
    similarArticleId: similarArticle?.articleId,
    similarityScore: similarArticle?.score,
  };
}
