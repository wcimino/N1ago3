import { callOpenAI } from "./openaiApiService.js";
import { storage } from "../storage.js";

export interface ClassificationPayload {
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
}

export interface ClassificationResult {
  product: string | null;
  intent: string | null;
  confidence: number | null;
  success: boolean;
  logId: number;
  error?: string;
}

const DEFAULT_CLASSIFICATION_PROMPT = `Analise a conversa de atendimento ao cliente abaixo e identifique:

1. **Produto**: Qual produto ou serviço o cliente está buscando ajuda? Exemplos: Conta Digital, Pix, Crédito, Cartão, Empréstimo, Investimentos, Seguros, etc.

2. **Intenção**: Qual é a intenção do cliente? Use uma das opções:
   - "contratar" - cliente quer adquirir/ativar um produto novo
   - "suporte" - cliente já tem o produto e precisa de ajuda
   - "cancelar" - cliente quer cancelar/encerrar um produto
   - "duvida" - cliente está tirando dúvidas antes de decidir
   - "reclamacao" - cliente está reclamando de algo
   - "outros" - outras situações

3. **Confiança**: De 0 a 100, qual a sua confiança na classificação?

**Mensagens da conversa:**
{{MENSAGENS}}

**Responda APENAS no formato JSON abaixo, sem texto adicional:**
{
  "product": "nome do produto",
  "intent": "tipo da intenção",
  "confidence": número de 0 a 100
}`;

export async function classifyConversation(
  payload: ClassificationPayload,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string
): Promise<ClassificationResult> {
  const messagesContext = payload.last20Messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const promptUser = DEFAULT_CLASSIFICATION_PROMPT
    .replace('{{MENSAGENS}}', messagesContext || 'Nenhuma mensagem disponível.');

  const promptSystem = "Você é um assistente especializado em classificar conversas de atendimento ao cliente de serviços financeiros. Responda sempre em JSON válido.";

  const result = await callOpenAI({
    requestType: "classification",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 256,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
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
  modelName: string,
  conversationId: number,
  externalConversationId: string | null
): Promise<ClassificationResult> {
  const result = await classifyConversation(
    payload,
    modelName,
    conversationId,
    externalConversationId || undefined
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
