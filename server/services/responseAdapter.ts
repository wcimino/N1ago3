import { callOpenAI } from "./openaiApiService.js";
import { storage } from "../storage.js";

export interface ResponsePayload {
  currentSummary: string | null;
  classification: {
    product: string | null;
    intent: string | null;
    confidence: number | null;
  } | null;
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  lastMessage: {
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  };
}

export interface ResponseResult {
  suggestedResponse: string | null;
  success: boolean;
  logId: number;
  error?: string;
}

export async function generateResponse(
  payload: ResponsePayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string
): Promise<ResponseResult> {
  const messagesContext = payload.last20Messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const lastMessageContext = `[${payload.lastMessage.authorType}${payload.lastMessage.authorName ? ` - ${payload.lastMessage.authorName}` : ''}]: ${payload.lastMessage.contentText || '(sem texto)'}`;

  const classificationContext = payload.classification
    ? `Produto: ${payload.classification.product || 'Não identificado'}\nIntenção: ${payload.classification.intent || 'Não identificada'}\nConfiança: ${payload.classification.confidence !== null ? `${payload.classification.confidence}%` : 'N/A'}`
    : 'Classificação não disponível';

  const promptUser = promptTemplate
    .replace('{{RESUMO}}', payload.currentSummary || 'Nenhum resumo disponível.')
    .replace('{{CLASSIFICACAO}}', classificationContext)
    .replace('{{ULTIMAS_20_MENSAGENS}}', messagesContext || 'Nenhuma mensagem anterior.')
    .replace('{{ULTIMA_MENSAGEM}}', lastMessageContext);

  const promptSystem = "Você é um assistente de atendimento ao cliente especializado em serviços financeiros. Sua função é sugerir respostas profissionais, empáticas e úteis para os atendentes responderem aos clientes. Responda apenas com a mensagem sugerida, sem explicações adicionais.";

  const result = await callOpenAI({
    requestType: "response",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 1024,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
  });

  if (!result.success || !result.responseContent) {
    return {
      suggestedResponse: null,
      success: false,
      logId: result.logId,
      error: result.error || "OpenAI returned empty response"
    };
  }

  return {
    suggestedResponse: result.responseContent.trim(),
    success: true,
    logId: result.logId
  };
}

export async function generateAndSaveResponse(
  payload: ResponsePayload,
  promptTemplate: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  lastEventId: number
): Promise<ResponseResult> {
  const result = await generateResponse(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined
  );

  if (result.success && result.suggestedResponse) {
    await storage.saveSuggestedResponse(conversationId, {
      suggestedResponse: result.suggestedResponse,
      lastEventId,
      openaiLogId: result.logId,
      externalConversationId,
    });

    console.log(`[Response Adapter] Suggested response saved for conversation ${conversationId}, logId: ${result.logId}`);
  }

  return result;
}
