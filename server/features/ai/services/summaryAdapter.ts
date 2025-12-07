import { callOpenAI, type OpenAICallResult } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";

export interface SummaryPayload {
  currentSummary: string | null;
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

export interface SummaryResult {
  summary: string;
  success: boolean;
  logId: number;
  error?: string;
}

export async function generateSummary(
  payload: SummaryPayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string
): Promise<SummaryResult> {
  const messagesContext = payload.last20Messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const lastMessageContext = `[${payload.lastMessage.authorType}${payload.lastMessage.authorName ? ` - ${payload.lastMessage.authorName}` : ''}]: ${payload.lastMessage.contentText || '(sem texto)'}`;

  const promptUser = promptTemplate
    .replace('{{RESUMO_ATUAL}}', payload.currentSummary || 'Nenhum resumo anterior disponível.')
    .replace('{{ULTIMAS_20_MENSAGENS}}', messagesContext || 'Nenhuma mensagem anterior.')
    .replace('{{ULTIMA_MENSAGEM}}', lastMessageContext);

  const promptSystem = "Você é um assistente especializado em gerar resumos de conversas de atendimento ao cliente. Gere resumos concisos e informativos.";

  const result = await callOpenAI({
    requestType: "summary",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 1024,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
  });

  if (!result.success || !result.responseContent) {
    return {
      summary: "",
      success: false,
      logId: result.logId,
      error: result.error || "OpenAI returned empty response"
    };
  }

  return {
    summary: result.responseContent,
    success: true,
    logId: result.logId
  };
}

export async function generateAndSaveSummary(
  payload: SummaryPayload,
  promptTemplate: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  lastEventId: number
): Promise<SummaryResult> {
  const result = await generateSummary(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined
  );

  if (result.success) {
    await storage.upsertConversationSummary({
      conversationId,
      externalConversationId: externalConversationId || undefined,
      summary: result.summary,
      lastEventId,
    });

    console.log(`[Summary Adapter] Summary saved for conversation ${conversationId}, logId: ${result.logId}`);
  }

  return result;
}
