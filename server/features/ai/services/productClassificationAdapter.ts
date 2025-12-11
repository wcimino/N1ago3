import { callOpenAI } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";
import { replacePromptVariables, formatMessagesContext } from "./promptUtils.js";

export interface ClassificationPayload {
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
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

const DEFAULT_CLASSIFICATION_PROMPT = `Você é um assistente especializado em classificar conversas de atendimento ao cliente de serviços financeiros.

## Catálogo de Produtos
Use APENAS as combinações de produto/subproduto listadas abaixo. Copie os valores exatamente como aparecem:

{{CATALOGO_PRODUTOS_SUBPRODUTOS}}

## Contexto da Conversa

### Resumo
{{RESUMO}}

### Mensagens
{{MENSAGENS}}

## Sua Tarefa
Classifique a conversa identificando os campos:

1. **Produto**: Escolha da lista acima (copie o valor exato do campo "produto")
2. **Subproduto**: Copie o valor exato do campo "subproduto" correspondente, ou null se não houver
3. **Assunto**: Tema principal da conversa
4. **Intenção**: O que o cliente deseja
5. **Confiança**: Seu nível de certeza na classificação (0-100)

Use APENAS os produtos/subprodutos que existem no catálogo acima. Se não identificar claramente, use null.`;

const DEFAULT_CLASSIFICATION_RESPONSE_FORMAT = `Responda em JSON válido:
{
  "product": "valor exato do campo produto do catálogo",
  "subproduct": "valor exato do campo subproduto do catálogo, ou null",
  "subject": "tema principal da conversa",
  "intent": "o que o cliente deseja",
  "confidence": 85
}`;

export async function classifyConversation(
  payload: ClassificationPayload,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useSubjectIntentTool: boolean = false
): Promise<ClassificationResult> {
  const messagesContext = formatMessagesContext(payload.last20Messages);

  const variables = {
    resumo: payload.currentSummary,
    mensagens: messagesContext,
    ultimas20Mensagens: messagesContext,
    catalogoProdutosSubprodutos: payload.productCatalogJson,
  };

  const basePrompt = promptSystem || DEFAULT_CLASSIFICATION_PROMPT;
  const format = responseFormat || DEFAULT_CLASSIFICATION_RESPONSE_FORMAT;
  
  const promptWithVars = replacePromptVariables(basePrompt, variables);
  const fullPrompt = `${promptWithVars}\n\n## Formato da Resposta\n${format}`;

  const effectiveUseProductCatalogTool = payload.productCatalogJson ? false : useProductCatalogTool;

  const result = await callOpenAI({
    requestType: "classification",
    modelName,
    promptSystem: "Você é um classificador especializado. Responda sempre em JSON válido.",
    promptUser: fullPrompt,
    maxTokens: 512,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    toolFlags: {
      useKnowledgeBaseTool,
      useProductCatalogTool: effectiveUseProductCatalogTool,
      useSubjectIntentTool,
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
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useSubjectIntentTool: boolean = false
): Promise<ClassificationResult> {
  const result = await classifyConversation(
    payload,
    promptSystem,
    responseFormat,
    modelName,
    conversationId,
    externalConversationId || undefined,
    useKnowledgeBaseTool,
    useProductCatalogTool,
    useSubjectIntentTool
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
