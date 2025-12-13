import { callOpenAI, type OpenAICallResult } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";
import { replacePromptVariables, formatMessagesContext, formatLastMessage, type ContentPayload } from "./promptUtils.js";
import type { ToolFlags } from "./aiTools.js";

export interface SummaryPayload {
  currentSummary: string | null;
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  }>;
  lastMessage: {
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  };
}

export interface ObjectiveProblemResult {
  id: number;
  name: string;
  matchScore?: number;
}

export interface ArticleAndProblemResult {
  source: "article" | "problem";
  id: number;
  name: string | null;
  description: string;
  resolution?: string;
  matchScore?: number;
  matchReason?: string;
  products?: string[];
}

export interface StructuredSummary {
  clientRequest?: string;
  agentActions?: string;
  currentStatus?: string;
  importantInfo?: string;
  customerEmotionLevel?: number;
  customerRequestType?: string;
  objectiveProblems?: ObjectiveProblemResult[];
  articlesAndObjectiveProblems?: ArticleAndProblemResult[];
}

export interface SummaryResult {
  summary: string;
  structured?: StructuredSummary;
  success: boolean;
  logId: number;
  error?: string;
}

const DEFAULT_SUMMARY_PROMPT = `Você é um assistente especializado em gerar resumos de conversas de atendimento ao cliente.

## Contexto da Conversa

### Resumo Anterior
{{RESUMO_ATUAL}}

### Últimas Mensagens
{{ULTIMAS_20_MENSAGENS}}

### Última Mensagem
{{ULTIMA_MENSAGEM}}

## Sua Tarefa
Gere um resumo atualizado e conciso da conversa, incorporando as novas mensagens ao resumo anterior (se existir).

O resumo deve:
- Identificar o problema ou solicitação do cliente
- Registrar as ações do atendente
- Indicar o status atual do atendimento
- Destacar informações importantes`;

const DEFAULT_SUMMARY_RESPONSE_FORMAT = `Responda em JSON com a seguinte estrutura:
{
  "clientRequest": "O que o cliente solicitou ou qual problema relatou",
  "agentActions": "O que o atendente fez para resolver",
  "currentStatus": "Status atual: Resolvido, Em andamento, Aguardando cliente, etc",
  "importantInfo": "Informações relevantes como prazos, valores, documentos pendentes",
  "customerEmotionLevel": 3,
  "articlesAndObjectiveProblems": [
    {"source": "article", "id": 1, "name": "Nome do artigo", "description": "Descrição", "matchScore": 85},
    {"source": "problem", "id": 2, "name": "Nome do problema", "description": "Descrição", "matchScore": 75}
  ]
}

## Escala de Emoção do Cliente (customerEmotionLevel):
- 1: Muito feliz/positivo - Entusiasmado, cordial, elogiando, tom leve
- 2: Levemente positivo - Educado, simpático, colaborativo
- 3: Neutro - Direto, factual, sem emoção aparente
- 4: Levemente irritado - Impaciente, seco, reclama, pressiona
- 5: Muito irritado/crítico - Tom agressivo, tensão alta, perda de paciência

## Campo articlesAndObjectiveProblems:
Se você usou a ferramenta de busca de artigos e problemas, inclua os resultados encontrados neste campo.
Cada item deve ter: source ("article" ou "problem"), id, name, description e matchScore (porcentagem de relevância).

Avalie o nível de emoção do cliente com base nas últimas mensagens da conversa.`;

function parseStructuredSummary(responseContent: string): StructuredSummary | null {
  try {
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const emotionLevel = parsed.customerEmotionLevel || parsed.customer_emotion_level || parsed.nivelEmocaoCliente || parsed.nivel_emocao_cliente;
    const validEmotionLevel = typeof emotionLevel === 'number' && emotionLevel >= 1 && emotionLevel <= 5 
      ? emotionLevel 
      : undefined;
    
    let objectiveProblems: ObjectiveProblemResult[] | undefined;
    const rawProblems = parsed.objectiveProblems || parsed.problemasObjetivos || parsed.problemas_objetivos;
    if (Array.isArray(rawProblems) && rawProblems.length > 0) {
      objectiveProblems = rawProblems
        .filter((p: any) => p && typeof p.id === 'number' && typeof p.name === 'string')
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          matchScore: typeof p.matchScore === 'number' ? p.matchScore : undefined,
        }));
      if (objectiveProblems.length === 0) objectiveProblems = undefined;
    }

    let articlesAndObjectiveProblems: ArticleAndProblemResult[] | undefined;
    const rawArticlesAndProblems = parsed.articlesAndObjectiveProblems || parsed.artigosEProblemas || parsed.artigos_e_problemas;
    if (Array.isArray(rawArticlesAndProblems) && rawArticlesAndProblems.length > 0) {
      articlesAndObjectiveProblems = rawArticlesAndProblems
        .filter((item: any) => item && typeof item.id === 'number' && (item.source === 'article' || item.source === 'problem'))
        .map((item: any) => ({
          source: item.source as "article" | "problem",
          id: item.id,
          name: item.name || null,
          description: item.description || '',
          resolution: item.resolution,
          matchScore: typeof item.matchScore === 'number' ? item.matchScore : undefined,
          matchReason: item.matchReason,
          products: Array.isArray(item.products) ? item.products : undefined,
        }));
      if (articlesAndObjectiveProblems.length === 0) articlesAndObjectiveProblems = undefined;
    }

    const customerRequestType = parsed.customerRequestType || parsed.tipoSolicitacaoCliente || parsed.tipo_solicitacao_cliente ||
      parsed.triage?.anamnese?.customerRequestType || undefined;

    return {
      clientRequest: parsed.clientRequest || parsed.solicitacaoCliente || parsed.solicitacao_cliente || undefined,
      agentActions: parsed.agentActions || parsed.acoesAtendente || parsed.acoes_atendente || undefined,
      currentStatus: parsed.currentStatus || parsed.statusAtual || parsed.status_atual || undefined,
      importantInfo: parsed.importantInfo || parsed.informacoesImportantes || parsed.informacoes_importantes || undefined,
      customerEmotionLevel: validEmotionLevel,
      customerRequestType,
      objectiveProblems,
      articlesAndObjectiveProblems,
    };
  } catch {
    return null;
  }
}

export async function generateSummary(
  payload: SummaryPayload,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  toolFlags?: Partial<ToolFlags>
): Promise<SummaryResult> {
  const messagesContext = formatMessagesContext(payload.last20Messages);
  const lastMessageContext = formatLastMessage(payload.lastMessage);

  const variables = {
    resumo: payload.currentSummary,
    resumoAtual: payload.currentSummary,
    ultimas20Mensagens: messagesContext,
    ultimaMensagem: lastMessageContext,
    mensagens: messagesContext,
  };

  const basePrompt = promptSystem || DEFAULT_SUMMARY_PROMPT;
  const format = responseFormat || DEFAULT_SUMMARY_RESPONSE_FORMAT;
  
  const promptWithVars = replacePromptVariables(basePrompt, variables);
  const fullPrompt = `${promptWithVars}\n\n## Formato da Resposta\n${format}`;

  const result = await callOpenAI({
    requestType: "summary",
    modelName,
    promptSystem: "Você é um assistente especializado em análise de conversas de atendimento.",
    promptUser: fullPrompt,
    maxTokens: 1024,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    toolFlags,
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
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  lastEventId: number,
  toolFlags?: Partial<ToolFlags>
): Promise<SummaryResult> {
  const result = await generateSummary(
    payload,
    promptSystem,
    responseFormat,
    modelName,
    conversationId,
    externalConversationId || undefined,
    toolFlags
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
      customerEmotionLevel: result.structured?.customerEmotionLevel,
      customerRequestType: result.structured?.customerRequestType,
      objectiveProblems: result.structured?.objectiveProblems,
      articlesAndObjectiveProblems: result.structured?.articlesAndObjectiveProblems,
      lastEventId,
    });

    console.log(`[Summary Adapter] Summary saved for conversation ${conversationId}, logId: ${result.logId}`);
  }

  return result;
}
