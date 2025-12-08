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

export interface StructuredSummary {
  clientRequest?: string;
  agentActions?: string;
  currentStatus?: string;
  importantInfo?: string;
}

export interface SummaryResult {
  summary: string;
  structured?: StructuredSummary;
  success: boolean;
  logId: number;
  error?: string;
}

function parseStructuredSummary(responseContent: string): StructuredSummary | null {
  try {
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      clientRequest: parsed.clientRequest || parsed.solicitacaoCliente || parsed.solicitacao_cliente || undefined,
      agentActions: parsed.agentActions || parsed.acoesAtendente || parsed.acoes_atendente || undefined,
      currentStatus: parsed.currentStatus || parsed.statusAtual || parsed.status_atual || undefined,
      importantInfo: parsed.importantInfo || parsed.informacoesImportantes || parsed.informacoes_importantes || undefined,
    };
  } catch {
    return null;
  }
}

export async function generateSummary(
  payload: SummaryPayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  promptSystemFromConfig?: string | null
): Promise<SummaryResult> {
  const messagesContext = payload.last20Messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const lastMessageContext = `[${payload.lastMessage.authorType}${payload.lastMessage.authorName ? ` - ${payload.lastMessage.authorName}` : ''}]: ${payload.lastMessage.contentText || '(sem texto)'}`;

  const promptUser = promptTemplate
    .replace('{{RESUMO_ATUAL}}', payload.currentSummary || 'Nenhum resumo anterior disponível.')
    .replace('{{ULTIMAS_20_MENSAGENS}}', messagesContext || 'Nenhuma mensagem anterior.')
    .replace('{{ULTIMA_MENSAGEM}}', lastMessageContext);

  const promptSystem = promptSystemFromConfig || "Você é um assistente especializado em gerar resumos de conversas de atendimento ao cliente. Gere resumos concisos e informativos.";

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

  const structured = parseStructuredSummary(result.responseContent);

  return {
    summary: result.responseContent,
    structured: structured || undefined,
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
  lastEventId: number,
  promptSystemFromConfig?: string | null
): Promise<SummaryResult> {
  const result = await generateSummary(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined,
    promptSystemFromConfig
  );

  if (result.success) {
    await storage.upsertConversationSummary({
      conversationId,
      externalConversationId: externalConversationId || undefined,
      summary: result.summary,
      clientRequest: result.structured?.clientRequest,
      agentActions: result.structured?.agentActions,
      currentStatus: result.structured?.currentStatus,
      importantInfo: result.structured?.importantInfo,
      lastEventId,
    });

    console.log(`[Summary Adapter] Summary saved for conversation ${conversationId}, logId: ${result.logId}`);
  }

  return result;
}
