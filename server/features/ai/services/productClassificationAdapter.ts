import { callOpenAI } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";
import { replacePromptVariables, formatMessagesContext, type ContentPayload } from "./promptUtils.js";

export interface ClassificationPayload {
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  }>;
  currentSummary?: string | null;
  productCatalogJson?: string | null;
}

export interface ClassificationResult {
  product: string | null;
  subproduct: string | null;
  subject: string | null;
  intent: string | null;
  confidence: number | null;
  success: boolean;
  logId: number;
  error?: string;
}

export async function classifyConversation(
  payload: ClassificationPayload,
  promptTemplate: string | null,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useSubjectIntentTool: boolean = false,
  useCombinedKnowledgeSearchTool: boolean = false
): Promise<ClassificationResult> {
  if (!promptTemplate || !promptTemplate.trim()) {
    console.error("[Classification Adapter] Erro: Prompt de classificação não configurado no banco de dados");
    return {
      product: null,
      subproduct: null,
      subject: null,
      intent: null,
      confidence: null,
      success: false,
      logId: 0,
      error: "Prompt de classificação não configurado. Configure o prompt em Configurações de IA > Classificação de Produto."
    };
  }

  if (!responseFormat || !responseFormat.trim()) {
    console.error("[Classification Adapter] Erro: Formato de resposta não configurado no banco de dados");
    return {
      product: null,
      subproduct: null,
      subject: null,
      intent: null,
      confidence: null,
      success: false,
      logId: 0,
      error: "Formato de resposta não configurado. Configure o formato em Configurações de IA > Classificação de Produto."
    };
  }

  const messagesContext = formatMessagesContext(payload.last20Messages);

  const variables = {
    resumo: payload.currentSummary,
    mensagens: messagesContext,
    ultimas20Mensagens: messagesContext,
    catalogoProdutosSubprodutos: payload.productCatalogJson,
  };

  const promptWithVars = replacePromptVariables(promptTemplate, variables);
  const fullPrompt = `${promptWithVars}\n\n## Formato da Resposta\n${responseFormat}`;
  const effectivePromptSystem = promptSystem || "Você é um classificador especializado. Responda sempre em JSON válido.";

  const effectiveUseProductCatalogTool = payload.productCatalogJson ? false : useProductCatalogTool;

  const result = await callOpenAI({
    requestType: "classification",
    modelName,
    promptSystem: effectivePromptSystem,
    promptUser: fullPrompt,
    maxTokens: 512,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    toolFlags: {
      useKnowledgeBaseTool,
      useProductCatalogTool: effectiveUseProductCatalogTool,
      useSubjectIntentTool,
      useCombinedKnowledgeSearchTool,
    },
    toolFlagsContext: {
      conversationId,
    },
    maxIterations: 5,
  });

  if (!result.success || !result.responseContent) {
    return {
      product: null,
      subproduct: null,
      subject: null,
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
      subproduct: parsed.subproduct || null,
      subject: parsed.subject || null,
      intent: parsed.intent || null,
      confidence: confidenceValue,
      success: true,
      logId: result.logId
    };
  } catch (parseError: any) {
    console.error(`[Classification Adapter] Failed to parse response: ${parseError.message}`);
    return {
      product: null,
      subproduct: null,
      subject: null,
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
  promptTemplate: string | null,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useSubjectIntentTool: boolean = false,
  useCombinedKnowledgeSearchTool: boolean = false
): Promise<ClassificationResult> {
  const result = await classifyConversation(
    payload,
    promptTemplate,
    promptSystem,
    responseFormat,
    modelName,
    conversationId,
    externalConversationId || undefined,
    useKnowledgeBaseTool,
    useProductCatalogTool,
    useSubjectIntentTool,
    useCombinedKnowledgeSearchTool
  );

  if (result.success && result.product) {
    await storage.updateConversationClassification(conversationId, {
      product: result.product,
      subproduct: result.subproduct,
      subject: result.subject,
      intent: result.intent,
      confidence: result.confidence,
    });

    console.log(`[Classification Adapter] Classification saved for conversation ${conversationId}: ${result.product}/${result.subproduct}/${result.subject}/${result.intent} (${result.confidence}%), logId: ${result.logId}`);
  }

  return result;
}
