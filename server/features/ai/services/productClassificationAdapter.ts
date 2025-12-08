import { callOpenAI, type ToolDefinition } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";

export interface ClassificationPayload {
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  currentSummary?: string | null;
}

export interface ClassificationResult {
  product: string | null;
  intent: string | null;
  confidence: number | null;
  success: boolean;
  logId: number;
  error?: string;
}

function createProductCatalogTool(): ToolDefinition {
  return {
    name: "search_product_catalog",
    description: "Busca produtos no catálogo hierárquico. Use para encontrar os produtos válidos antes de classificar a conversa. Retorna lista de produtos com seus fullNames que devem ser usados na classificação.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca para filtrar produtos (ex: 'cartão', 'empréstimo', 'antecipação'). Deixe vazio para listar todos."
        }
      },
      required: []
    },
    handler: async (args: { query?: string }) => {
      const products = await storage.getIfoodProducts(args.query || "");
      
      if (products.length === 0) {
        return JSON.stringify({ 
          message: "Nenhum produto encontrado no catálogo",
          products: [] 
        });
      }
      
      const productList = products.map(p => ({
        fullName: p.fullName,
        produto: p.produto,
        subproduto: p.subproduto,
        categoria1: p.categoria1,
        categoria2: p.categoria2
      }));
      
      return JSON.stringify({
        message: `Encontrados ${products.length} produtos no catálogo`,
        products: productList
      });
    }
  };
}

export async function classifyConversation(
  payload: ClassificationPayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useProductCatalogTool: boolean = false
): Promise<ClassificationResult> {
  const messagesContext = payload.last20Messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const promptUser = promptTemplate
    .replace('{{MENSAGENS}}', messagesContext || 'Nenhuma mensagem disponível.')
    .replace('{{RESUMO}}', payload.currentSummary || 'Nenhum resumo disponível.');

  const promptSystem = "Você é um assistente especializado em classificar conversas de atendimento ao cliente de serviços financeiros. Responda sempre em JSON válido.";

  const tools: ToolDefinition[] = [];
  if (useProductCatalogTool) {
    tools.push(createProductCatalogTool());
  }

  const result = await callOpenAI({
    requestType: "classification",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 512,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    tools: tools.length > 0 ? tools : undefined,
    maxIterations: 3,
  });

  if (!result.success || !result.responseContent) {
    return {
      product: null,
      intent: null,
      confidence: null,
      success: false,
      logId: result.logId,
      error: result.error || "OpenAI returned empty response"
    };
  }

  try {
    const jsonMatch = result.responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const confidenceValue = typeof parsed.confidence === 'number' 
      ? Math.round(Math.min(100, Math.max(0, parsed.confidence))) 
      : null;
    
    return {
      product: parsed.product || null,
      intent: parsed.intent || null,
      confidence: confidenceValue,
      success: true,
      logId: result.logId
    };
  } catch (parseError: any) {
    console.error(`[Classification Adapter] Failed to parse response: ${parseError.message}`);
    return {
      product: null,
      intent: null,
      confidence: null,
      success: false,
      logId: result.logId,
      error: `Failed to parse JSON: ${parseError.message}`
    };
  }
}

export async function classifyAndSave(
  payload: ClassificationPayload,
  promptTemplate: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  useProductCatalogTool: boolean = false
): Promise<ClassificationResult> {
  const result = await classifyConversation(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined,
    useProductCatalogTool
  );

  if (result.success && result.product) {
    await storage.updateConversationClassification(conversationId, {
      product: result.product,
      intent: result.intent,
      confidence: result.confidence,
    });

    console.log(`[Classification Adapter] Classification saved for conversation ${conversationId}: ${result.product}/${result.intent} (${result.confidence}%), logId: ${result.logId}`);
  }

  return result;
}
