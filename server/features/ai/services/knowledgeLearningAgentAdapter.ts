import OpenAI from "openai";
import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import { db } from "../../../db.js";
import { openaiApiLogs } from "../../../../shared/schema.js";

const openai = new OpenAI();

export interface AgentLearningPayload {
  messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  currentSummary: string | null;
  conversationHandler: string | null;
}

export interface AgentLearningResult {
  success: boolean;
  suggestionId?: number;
  suggestionType?: "create" | "update" | "skip";
  targetArticleId?: number;
  error?: string;
  logId?: number;
}

type SuggestionType = "create" | "update" | "skip";

const AGENT_SYSTEM_PROMPT = `Você é um especialista em gestão de base de conhecimento para atendimento ao cliente.

Sua tarefa é analisar conversas de atendimento e decidir se o conhecimento extraído deve:
1. CRIAR um novo artigo na base de conhecimento
2. ATUALIZAR um artigo existente (adicionar informação, corrigir, complementar)
3. IGNORAR se não há conhecimento útil ou se já existe artigo idêntico

## PROCESSO OBRIGATÓRIO:

1. Primeiro, analise a conversa para identificar o tema principal (produto, problema, solução)
2. Use a ferramenta search_knowledge_base para buscar artigos existentes sobre esse tema
3. Analise os artigos encontrados (se houver)
4. Decida a ação apropriada usando create_knowledge_suggestion

## REGRAS PARA DECISÃO:

### ATUALIZAR artigo existente quando:
- O artigo existente trata do MESMO problema/tema
- A conversa traz informação ADICIONAL útil (novo passo, exceção, caso especial)
- A solução da conversa é mais completa ou atualizada
- O artigo precisa de correção ou complemento

### CRIAR novo artigo quando:
- NÃO existe artigo sobre esse tema específico
- O problema é suficientemente diferente dos artigos existentes
- A combinação produto + categoria + problema é nova

### IGNORAR quando:
- Conversa não tem solução clara
- Artigo existente já cobre exatamente o mesmo conteúdo
- Qualidade da informação é baixa ou incompleta

## FORMATO DA SOLUÇÃO (CRÍTICO!):

A solução é uma INSTRUÇÃO para futuros atendimentos, NÃO um relato do passado.

❌ PROIBIDO: "Cliente foi orientado a...", "Foi explicado ao cliente que..."
✅ CORRETO: "Orientar o cliente a...", "Verificar se...", "Informar que..."

Sempre use verbos no INFINITIVO (Orientar, Verificar, Solicitar, Informar).`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Busca artigos existentes na base de conhecimento. Use para verificar se já existe informação sobre o tema antes de decidir criar ou atualizar.",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "string",
            description: "Produto principal (ex: Antecipação, Repasse, Conta Digital, Cartão, Pix)"
          },
          category: {
            type: "string",
            description: "Categoria do problema (ex: Consulta, Solicitação, Reclamação, Cancelamento)"
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Palavras-chave relevantes para busca (ex: ['prazo', 'valores', 'documentos'])"
          }
        },
        required: ["product"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_knowledge_suggestion",
      description: "Cria uma sugestão de conhecimento. Use após analisar os artigos existentes.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "update", "skip"],
            description: "Ação a tomar: create (novo artigo), update (atualizar existente), skip (ignorar)"
          },
          targetArticleId: {
            type: "number",
            description: "ID do artigo a atualizar (obrigatório se action=update)"
          },
          updateReason: {
            type: "string",
            description: "Motivo da atualização (obrigatório se action=update). Ex: 'Adicionar passo sobre verificação de saldo', 'Corrigir prazo de processamento'"
          },
          productStandard: {
            type: "string",
            description: "Produto principal padronizado"
          },
          subproductStandard: {
            type: "string",
            description: "Subproduto específico (se aplicável)"
          },
          category1: {
            type: "string",
            description: "Categoria principal do problema"
          },
          category2: {
            type: "string",
            description: "Subcategoria (se aplicável)"
          },
          description: {
            type: "string",
            description: "Descrição do problema/situação (aplicável a qualquer cliente)"
          },
          resolution: {
            type: "string",
            description: "Solução detalhada com passos específicos. Use verbos no infinitivo."
          },
          observations: {
            type: "string",
            description: "Observações adicionais, exceções, casos especiais"
          },
          confidenceScore: {
            type: "number",
            description: "Nível de confiança de 0 a 100"
          },
          skipReason: {
            type: "string",
            description: "Motivo para ignorar (obrigatório se action=skip)"
          }
        },
        required: ["action"]
      }
    }
  }
];

async function handleSearchKnowledgeBase(args: {
  product: string;
  category?: string;
  keywords?: string[];
}): Promise<string> {
  const results = await knowledgeBaseService.findRelatedArticles(
    args.product,
    args.category,
    args.keywords || [],
    { limit: 5, minScore: 20 }
  );

  if (results.length === 0) {
    return "Nenhum artigo encontrado para esses critérios.";
  }

  return results.map((r, i) => `
### Artigo ${i + 1} (ID: ${r.article.id}, Score: ${r.relevanceScore})
- Produto: ${r.article.productStandard}
- Subproduto: ${r.article.subproductStandard || "N/A"}
- Categoria: ${r.article.category1 || "N/A"}${r.article.category2 ? ` / ${r.article.category2}` : ""}
- Descrição: ${r.article.description}
- Resolução: ${r.article.resolution}
- Observações: ${r.article.observations || "N/A"}
`).join("\n");
}

export async function extractKnowledgeWithAgent(
  payload: AgentLearningPayload,
  modelName: string = "gpt-4o",
  conversationId: number,
  externalConversationId: string | null
): Promise<AgentLearningResult> {
  const startTime = Date.now();
  
  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const userMessage = `## Conversa de Atendimento

${messagesContext}

## Resumo da Conversa
${payload.currentSummary || 'Nenhum resumo disponível.'}

## Instruções
1. Identifique o tema principal da conversa (produto, problema)
2. Use search_knowledge_base para buscar artigos existentes
3. Analise se algum artigo existente cobre o tema
4. Use create_knowledge_suggestion para registrar sua decisão`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userMessage }
  ];

  let suggestionResult: {
    action: SuggestionType;
    targetArticleId?: number;
    updateReason?: string;
    productStandard?: string;
    subproductStandard?: string;
    category1?: string;
    category2?: string;
    description?: string;
    resolution?: string;
    observations?: string;
    confidenceScore?: number;
    skipReason?: string;
  } | null = null;

  let totalTokens = 0;
  let iterations = 0;
  const maxIterations = 5;

  try {
    while (iterations < maxIterations) {
      iterations++;
      
      const response = await openai.chat.completions.create({
        model: modelName,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 2048
      });

      const choice = response.choices[0];
      totalTokens += response.usage?.total_tokens || 0;

      if (choice.finish_reason === "stop" || !choice.message.tool_calls) {
        break;
      }

      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult: string;

        if (toolCall.function.name === "search_knowledge_base") {
          toolResult = await handleSearchKnowledgeBase(args);
          console.log(`[Learning Agent] Search KB: product=${args.product}, found results`);
        } else if (toolCall.function.name === "create_knowledge_suggestion") {
          suggestionResult = args;
          toolResult = `Sugestão registrada: action=${args.action}${args.targetArticleId ? `, targetArticleId=${args.targetArticleId}` : ''}`;
          console.log(`[Learning Agent] Suggestion: action=${args.action}, targetArticleId=${args.targetArticleId || 'N/A'}`);
        } else {
          toolResult = "Ferramenta desconhecida";
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      if (suggestionResult) {
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    const [logEntry] = await db.insert(openaiApiLogs).values({
      requestType: "learning_agent",
      modelName,
      promptSystem: AGENT_SYSTEM_PROMPT,
      promptUser: userMessage,
      responseRaw: { iterations, suggestionResult },
      responseContent: JSON.stringify(suggestionResult),
      tokensTotal: totalTokens,
      durationMs,
      success: !!suggestionResult,
      contextType: "conversation",
      contextId: externalConversationId || String(conversationId)
    }).returning();

    if (!suggestionResult) {
      return {
        success: false,
        error: "Agent did not produce a suggestion",
        logId: logEntry.id
      };
    }

    if (suggestionResult.action === "skip") {
      console.log(`[Learning Agent] Skipping conversation ${conversationId}: ${suggestionResult.skipReason}`);
      return {
        success: true,
        suggestionType: "skip",
        logId: logEntry.id
      };
    }

    const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
      conversationId,
      externalConversationId,
      suggestionType: suggestionResult.action,
      productStandard: suggestionResult.productStandard,
      subproductStandard: suggestionResult.subproductStandard,
      category1: suggestionResult.category1,
      category2: suggestionResult.category2,
      description: suggestionResult.description,
      resolution: suggestionResult.resolution,
      observations: suggestionResult.observations,
      confidenceScore: suggestionResult.confidenceScore,
      similarArticleId: suggestionResult.targetArticleId,
      updateReason: suggestionResult.updateReason,
      status: "pending",
      conversationHandler: payload.conversationHandler,
      rawExtraction: suggestionResult
    });

    console.log(`[Learning Agent] Suggestion saved: id=${suggestion.id}, type=${suggestionResult.action}, targetArticle=${suggestionResult.targetArticleId || 'N/A'}`);

    return {
      success: true,
      suggestionId: suggestion.id,
      suggestionType: suggestionResult.action,
      targetArticleId: suggestionResult.targetArticleId,
      logId: logEntry.id
    };

  } catch (error) {
    console.error("[Learning Agent] Error:", error);
    
    const [logEntry] = await db.insert(openaiApiLogs).values({
      requestType: "learning_agent",
      modelName,
      promptSystem: AGENT_SYSTEM_PROMPT,
      promptUser: userMessage,
      success: false,
      errorMessage: String(error),
      contextType: "conversation",
      contextId: externalConversationId || String(conversationId)
    }).returning();

    return {
      success: false,
      error: String(error),
      logId: logEntry.id
    };
  }
}
