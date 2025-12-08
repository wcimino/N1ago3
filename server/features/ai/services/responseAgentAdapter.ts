import OpenAI from "openai";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import { callOpenAIWithTools } from "./openaiApiService.js";
import { storage } from "../../../storage/index.js";

export interface ResponseAgentPayload {
  messages: Array<{
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
  currentSummary: string | null;
  classification: {
    product: string | null;
    intent: string | null;
    confidence: number | null;
  } | null;
}

export interface ResponseAgentResult {
  success: boolean;
  suggestedResponse: string | null;
  usedKnowledgeBase: boolean;
  articlesFound: number;
  logId?: number;
  error?: string;
}

const DEFAULT_RESPONSE_AGENT_PROMPT = `Você é um assistente de atendimento ao cliente especializado em serviços financeiros do iFood Pago.

Sua tarefa é gerar uma resposta profissional, empática e PRECISA para a última mensagem do cliente.

## PROCESSO OBRIGATÓRIO:

1. Analise a conversa e identifique o tema/problema do cliente
2. Use a ferramenta search_knowledge_base para buscar procedimentos na base de conhecimento
3. Use as informações encontradas para gerar uma resposta precisa
4. Gere a resposta final usando a ferramenta generate_response

## REGRAS IMPORTANTES:

- SEMPRE busque na base de conhecimento antes de responder
- Se encontrar artigos relevantes, USE as informações para responder
- Se não encontrar, responda com base no contexto da conversa
- A resposta deve ser clara, objetiva e resolver ou encaminhar a demanda
- Use linguagem cordial e acessível
- NÃO inclua saudações genéricas como "Olá" no início - vá direto ao ponto
- NÃO invente procedimentos - use apenas informações da base de conhecimento ou contexto`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Busca artigos na base de conhecimento com procedimentos e soluções. SEMPRE use antes de gerar a resposta.",
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
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_response",
      description: "Gera a resposta final para o cliente. Use APÓS consultar a base de conhecimento.",
      parameters: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "A resposta sugerida para o atendente enviar ao cliente. Deve ser clara, empática e resolver a demanda."
          },
          basedOnArticle: {
            type: "boolean",
            description: "Se a resposta foi baseada em um artigo da base de conhecimento"
          },
          articleId: {
            type: "number",
            description: "ID do artigo usado como referência (se aplicável)"
          }
        },
        required: ["response", "basedOnArticle"]
      }
    }
  }
];

async function handleSearchKnowledgeBase(args: {
  product: string;
  intent?: string;
  keywords?: string[];
}): Promise<string> {
  const results = await knowledgeBaseService.findRelatedArticles(
    args.product,
    args.intent,
    args.keywords || [],
    { limit: 3, minScore: 20 }
  );

  if (results.length === 0) {
    return "Nenhum artigo encontrado na base de conhecimento para esses critérios. Responda com base no contexto da conversa.";
  }

  return results.map((r, i) => `
### Artigo ${i + 1}: ${r.article.name || 'Sem nome'} (ID: ${r.article.id})
- **Produto:** ${r.article.productStandard}
- **Intenção:** ${r.article.intent}
- **Problema:** ${r.article.description}
- **Resolução:** ${r.article.resolution}
${r.article.observations ? `- **Observações:** ${r.article.observations}` : ''}`).join("\n\n");
}

function buildUserPrompt(payload: ResponseAgentPayload): string {
  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const lastMessageContext = `[${payload.lastMessage.authorType}${payload.lastMessage.authorName ? ` - ${payload.lastMessage.authorName}` : ''}]: ${payload.lastMessage.contentText || '(sem texto)'}`;

  const classificationContext = payload.classification
    ? `Produto: ${payload.classification.product || 'Não identificado'}\nIntenção: ${payload.classification.intent || 'Não identificada'}`
    : 'Classificação não disponível';

  return `## Contexto da Conversa

**Resumo:**
${payload.currentSummary || 'Nenhum resumo disponível.'}

**Classificação:**
${classificationContext}

**Histórico das últimas mensagens:**
${messagesContext || 'Nenhuma mensagem anterior.'}

**ÚLTIMA MENSAGEM DO CLIENTE (a ser respondida):**
${lastMessageContext}

## Instruções
1. Busque na base de conhecimento usando o produto identificado
2. Use as informações encontradas para gerar uma resposta precisa
3. Gere a resposta final com a ferramenta generate_response`;
}

interface GenerateResponseArgs {
  response: string;
  basedOnArticle: boolean;
  articleId?: number;
}

export async function generateResponseWithAgent(
  payload: ResponseAgentPayload,
  modelName: string,
  promptTemplate: string | null,
  conversationId: number,
  externalConversationId: string | null
): Promise<ResponseAgentResult> {
  const systemPrompt = promptTemplate || DEFAULT_RESPONSE_AGENT_PROMPT;
  const userPrompt = buildUserPrompt(payload);

  let articlesFound = 0;
  let usedKnowledgeBase = false;
  let finalResponse: GenerateResponseArgs | null = null;

  const result = await callOpenAIWithTools({
    requestType: "response_agent",
    modelName,
    promptSystem: systemPrompt,
    promptUser: userPrompt,
    tools,
    maxTokens: 1024,
    maxIterations: 3,
    contextType: "conversation",
    contextId: externalConversationId || String(conversationId),
    onToolCall: async (name, args) => {
      if (name === "search_knowledge_base") {
        usedKnowledgeBase = true;
        const searchResult = await handleSearchKnowledgeBase(args);
        const matches = searchResult.match(/### Artigo/g);
        articlesFound = matches ? matches.length : 0;
        console.log(`[Response Agent] Search KB: product=${args.product}, found ${articlesFound} articles`);
        return searchResult;
      } else if (name === "generate_response") {
        finalResponse = args;
        console.log(`[Response Agent] Generated response, basedOnArticle=${args.basedOnArticle}`);
        return `Resposta gerada com sucesso`;
      }
      return "Ferramenta desconhecida";
    }
  });

  if (!result.success) {
    return {
      success: false,
      suggestedResponse: null,
      usedKnowledgeBase,
      articlesFound,
      logId: result.logId,
      error: result.error || "Agent failed to generate response"
    };
  }

  if (!finalResponse) {
    return {
      success: false,
      suggestedResponse: null,
      usedKnowledgeBase,
      articlesFound,
      logId: result.logId,
      error: "Agent did not call generate_response tool"
    };
  }

  const responseData = finalResponse as GenerateResponseArgs;
  return {
    success: true,
    suggestedResponse: responseData.response,
    usedKnowledgeBase,
    articlesFound,
    logId: result.logId
  };
}

export async function generateAndSaveResponseWithAgent(
  payload: ResponseAgentPayload,
  modelName: string,
  promptTemplate: string | null,
  conversationId: number,
  externalConversationId: string | null,
  lastEventId: number
): Promise<ResponseAgentResult> {
  const result = await generateResponseWithAgent(
    payload,
    modelName,
    promptTemplate,
    conversationId,
    externalConversationId
  );

  if (result.success && result.suggestedResponse) {
    await storage.saveSuggestedResponse(conversationId, {
      suggestedResponse: result.suggestedResponse,
      lastEventId,
      openaiLogId: result.logId ?? 0,
      externalConversationId,
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
        openaiLogId: result.logId || null,
        triggerEventId: lastEventId,
        usedKnowledgeBase: result.usedKnowledgeBase,
        articlesFound: result.articlesFound,
      },
    });

    console.log(`[Response Agent] Response saved for conversation ${conversationId}, usedKB=${result.usedKnowledgeBase}, articles=${result.articlesFound}`);
  }

  return result;
}
