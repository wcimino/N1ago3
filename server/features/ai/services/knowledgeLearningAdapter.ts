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
  promptSystem: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useProductCatalogTool: boolean = false
): Promise<LearningResult> {
  if (!promptTemplate || !promptTemplate.trim()) {
    throw new Error("Learning prompt template is required. Please configure it in the database.");
  }
  
  if (!promptSystem || !promptSystem.trim()) {
    throw new Error("Learning system prompt is required. Please configure it in the database.");
  }

  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const promptUser = promptTemplate
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
  promptSystem: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  useProductCatalogTool: boolean = false
): Promise<LearningResult> {
  const result = await extractKnowledge(
    payload,
    promptTemplate,
    promptSystem,
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
