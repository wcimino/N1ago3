import { callOpenAI, ToolDefinition } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import { createZendeskKnowledgeBaseTool } from "./aiTools.js";
import { replacePromptVariables, formatMessagesContext, formatLastMessage, formatClassification } from "./promptUtils.js";

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
  usedKnowledgeBase?: boolean;
  articlesFound?: number;
  error?: string;
}

const DEFAULT_RESPONSE_PROMPT = `Você é um assistente de atendimento ao cliente especializado em serviços financeiros do iFood Pago.
Sua tarefa é gerar uma resposta profissional, empática e PRECISA para a última mensagem do cliente.

## REGRAS IMPORTANTES:
- A resposta deve ser clara, objetiva e resolver ou encaminhar a demanda
- Use linguagem cordial e acessível
- NÃO inclua saudações genéricas como "Olá" no início - vá direto ao ponto
- NÃO invente procedimentos

## Contexto da Conversa

### Resumo
{{RESUMO}}

### Classificação
{{CLASSIFICACAO}}

### Histórico de Mensagens
{{ULTIMAS_20_MENSAGENS}}

### Última Mensagem (a ser respondida)
{{ULTIMA_MENSAGEM}}`;

const DEFAULT_RESPONSE_FORMAT = `Responda APENAS com a mensagem sugerida para o atendente enviar ao cliente.
Não inclua explicações, comentários ou formatação adicional.`;

const KB_SUFFIX = `

## PROCESSO OBRIGATÓRIO QUANDO BASE DE CONHECIMENTO ATIVADA:
1. Analise a conversa e identifique o tema/problema do cliente
2. Use a ferramenta search_knowledge_base para buscar procedimentos na base de conhecimento
3. Use as informações encontradas para gerar uma resposta precisa
- SEMPRE busque na base de conhecimento antes de responder
- Se encontrar artigos relevantes, USE as informações para responder
- Se não encontrar, responda com base no contexto da conversa
- NÃO invente procedimentos - use apenas informações da base de conhecimento ou contexto`;

function buildKnowledgeBaseTool(): ToolDefinition {
  return {
    name: "search_knowledge_base",
    description: "Busca artigos na base de conhecimento com procedimentos e soluções. Use para encontrar informações sobre como resolver o problema do cliente.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Produto relacionado (ex: Antecipação, Repasse, Conta Digital, Cartão, Empréstimo / Crédito, Maquinona)"
        },
        intent: {
          type: "string",
          description: "Intenção do cliente (ex: Dúvida, Solicitação, Reclamação, Cancelamento)"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Palavras-chave do problema (ex: ['senha', 'login', 'acesso'])"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; intent?: string; keywords?: string[] }) => {
      const results = await knowledgeBaseService.findRelatedArticles(
        args.product,
        args.intent,
        args.keywords || [],
        { limit: 3, minScore: 20 }
      );

      if (results.length === 0) {
        return "Nenhum artigo encontrado na base de conhecimento. Responda com base no contexto da conversa.";
      }

      return results.map((r, i) => `
### Artigo ${i + 1}: ${r.article.name || 'Sem nome'} (ID: ${r.article.id})
- **Produto:** ${r.article.productStandard}
- **Intenção:** ${r.article.intent}
- **Problema:** ${r.article.description}
- **Resolução:** ${r.article.resolution}
${r.article.observations ? `- **Observações:** ${r.article.observations}` : ''}`).join("\n\n");
    }
  };
}

export async function generateResponse(
  payload: ResponsePayload,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useZendeskKnowledgeBaseTool: boolean = false
): Promise<ResponseResult> {
  const tools: ToolDefinition[] = [];
  let articlesFound = 0;
  let usedKnowledgeBase = false;

  if (useKnowledgeBaseTool) {
    const kbTool = buildKnowledgeBaseTool();
    const originalHandler = kbTool.handler;
    kbTool.handler = async (args) => {
      usedKnowledgeBase = true;
      const result = await originalHandler(args);
      const matches = result.match(/### Artigo/g);
      articlesFound = matches ? matches.length : 0;
      console.log(`[Response Adapter] KB search: product=${args.product}, found ${articlesFound} articles`);
      return result;
    };
    tools.push(kbTool);
  }

  if (useZendeskKnowledgeBaseTool) {
    const zendeskTool = createZendeskKnowledgeBaseTool();
    const originalHandler = zendeskTool.handler;
    zendeskTool.handler = async (args) => {
      usedKnowledgeBase = true;
      const result = await originalHandler(args);
      console.log(`[Response Adapter] Zendesk KB search: keywords=${args.keywords}`);
      return result;
    };
    tools.push(zendeskTool);
  }

  const messagesContext = formatMessagesContext(payload.last20Messages);
  const lastMessageContext = formatLastMessage(payload.lastMessage);
  const classificationContext = formatClassification(payload.classification);

  const variables = {
    resumo: payload.currentSummary,
    classificacao: classificationContext,
    ultimas20Mensagens: messagesContext,
    ultimaMensagem: lastMessageContext,
    mensagens: messagesContext,
  };

  let basePrompt = promptSystem || DEFAULT_RESPONSE_PROMPT;
  if (useKnowledgeBaseTool || useZendeskKnowledgeBaseTool) {
    basePrompt += KB_SUFFIX;
  }
  
  const format = responseFormat || DEFAULT_RESPONSE_FORMAT;
  const promptWithVars = replacePromptVariables(basePrompt, variables);
  const fullPrompt = `${promptWithVars}\n\n## Formato da Resposta\n${format}`;

  const result = await callOpenAI({
    requestType: "response",
    modelName,
    promptSystem: "Você é um assistente de atendimento especializado.",
    promptUser: fullPrompt,
    maxTokens: 1024,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
    tools: tools.length > 0 ? tools : undefined,
    maxIterations: 3,
  });

  if (!result.success || !result.responseContent) {
    return {
      suggestedResponse: null,
      success: false,
      logId: result.logId,
      usedKnowledgeBase,
      articlesFound,
      error: result.error || "OpenAI returned empty response"
    };
  }

  return {
    suggestedResponse: result.responseContent.trim(),
    success: true,
    logId: result.logId,
    usedKnowledgeBase,
    articlesFound
  };
}

export async function generateAndSaveResponse(
  payload: ResponsePayload,
  promptSystem: string | null,
  responseFormat: string | null,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null,
  lastEventId: number,
  useKnowledgeBaseTool: boolean = false,
  useProductCatalogTool: boolean = false,
  useZendeskKnowledgeBaseTool: boolean = false,
  inResponseTo: string | null = null
): Promise<ResponseResult> {
  const result = await generateResponse(
    payload,
    promptSystem,
    responseFormat,
    modelName,
    conversationId,
    externalConversationId || undefined,
    useKnowledgeBaseTool,
    useProductCatalogTool,
    useZendeskKnowledgeBaseTool
  );

  if (result.success && result.suggestedResponse) {
    await storage.saveSuggestedResponse(conversationId, {
      suggestedResponse: result.suggestedResponse,
      lastEventId,
      openaiLogId: result.logId,
      externalConversationId,
      inResponseTo,
    });

    await storage.saveStandardEvent({
      eventType: "response_suggestion",
      source: "n1ago",
      conversationId,
      externalConversationId: externalConversationId || undefined,
      authorType: "system",
      authorName: "N1 Ago",
      contentText: result.suggestedResponse,
      occurredAt: new Date(),
      metadata: {
        openaiLogId: result.logId,
        triggerEventId: lastEventId,
        usedKnowledgeBase: result.usedKnowledgeBase,
        articlesFound: result.articlesFound,
      },
    });

    console.log(`[Response Adapter] Suggested response saved for conversation ${conversationId}, logId: ${result.logId}, usedKB: ${result.usedKnowledgeBase}, articles: ${result.articlesFound}`);
  }

  return result;
}
