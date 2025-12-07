import { callOpenAI } from "./openaiApiService.js";
import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";

export interface LearningPayload {
  messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  currentSummary: string | null;
  conversationHandler: string | null;
  relatedArticles?: string | null;
}

export interface ExtractedKnowledge {
  productStandard: string | null;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  description: string | null;
  resolution: string | null;
  observations: string | null;
  confidenceScore: number;
  qualityFlags: {
    isComplete: boolean;
    isUncertain: boolean;
    possibleError: boolean;
    needsReview: boolean;
  };
}

export interface LearningResult {
  success: boolean;
  extraction: ExtractedKnowledge | null;
  logId: number;
  suggestionId?: number;
  similarArticleId?: number;
  similarityScore?: number;
  error?: string;
}

const DEFAULT_PROMPT = `Você é um especialista em criar artigos de base de conhecimento a partir de conversas de atendimento ao cliente.

## REGRAS IMPORTANTES:

### 1. UM ASSUNTO POR ARTIGO
- Cada artigo deve tratar de APENAS UM tema/problema específico
- Se a conversa menciona múltiplos assuntos (ex: "antecipação" e "repasse"), escolha o PRINCIPAL que foi resolvido
- NÃO misture temas diferentes no mesmo artigo (ex: NÃO misture "valores não recebidos" com "plano de antecipação")

### 2. SOLUÇÃO GENÉRICA E REPLICÁVEL
- A solução deve ser GENÉRICA e aplicável a qualquer cliente com o mesmo problema
- NÃO inclua detalhes específicos do cliente na solução (ex: nomes, planos específicos, valores)
- A solução deve responder: "O que um atendente deve fazer quando qualquer cliente tiver esse problema?"
- Exemplo RUIM: "Cliente foi informado que possui plano iFood Delivery e precisa usar Portal do Parceiro"
- Exemplo BOM: "Orientar cliente sobre como acessar informações de antecipação pelo aplicativo"

### 3. OBSERVAÇÕES PARA DETALHES ESPECÍFICOS
- Use o campo "observations" para detalhes específicos que podem ser úteis mas não são a regra geral
- Exemplo: "Alguns clientes podem ter planos diferentes que requerem acesso por outros canais"

## IDENTIFICAÇÃO:
1. Produto principal (ex: Antecipação, Repasse, Conta Digital, Cartão)
2. Subproduto específico (ex: Receber Agora, Agenda de Recebíveis)
3. Categoria do problema (ex: Solicitação, Consulta, Reclamação, Cancelamento)
4. Subcategoria (ex: Valores, Prazo, Contratação)

## QUALIDADE:
- isComplete = false: se NÃO houver solução clara e replicável
- isUncertain = true: se a orientação não for definitiva
- possibleError = true: se a orientação parecer incorreta
- needsReview = true: se misturar assuntos ou tiver detalhes muito específicos

Retorne APENAS um JSON válido:
{
  "productStandard": "produto principal",
  "subproductStandard": "subproduto ou null",
  "category1": "categoria principal",
  "category2": "subcategoria ou null",
  "description": "descrição GENÉRICA do problema (aplicável a qualquer cliente)",
  "resolution": "solução GENÉRICA e replicável (sem detalhes específicos do cliente)",
  "observations": "detalhes específicos ou contextos especiais ou null",
  "confidenceScore": 0-100,
  "qualityFlags": {
    "isComplete": true/false,
    "isUncertain": true/false,
    "possibleError": true/false,
    "needsReview": true/false
  }
}

CONVERSA:
{{MENSAGENS}}

RESUMO DA CONVERSA:
{{RESUMO}}

ARTIGOS RELACIONADOS NA BASE DE CONHECIMENTO:
{{ARTIGOS_RELACIONADOS}}`;

export async function extractKnowledge(
  payload: LearningPayload,
  promptTemplate: string,
  modelName: string = "gpt-4o-mini",
  conversationId?: number,
  externalConversationId?: string
): Promise<LearningResult> {
  const messagesContext = payload.messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');

  const promptUser = (promptTemplate || DEFAULT_PROMPT)
    .replace('{{MENSAGENS}}', messagesContext || 'Nenhuma mensagem.')
    .replace('{{RESUMO}}', payload.currentSummary || 'Nenhum resumo disponível.')
    .replace('{{ARTIGOS_RELACIONADOS}}', payload.relatedArticles || 'Nenhum artigo relacionado encontrado.');

  const promptSystem = "Você é um especialista em extrair conhecimento de conversas de atendimento ao cliente. Responda sempre em JSON válido.";

  const result = await callOpenAI({
    requestType: "learning",
    modelName,
    promptSystem,
    promptUser,
    maxTokens: 2048,
    contextType: "conversation",
    contextId: externalConversationId || (conversationId ? String(conversationId) : undefined),
  });

  if (!result.success || !result.responseContent) {
    return {
      success: false,
      extraction: null,
      logId: result.logId,
      error: result.error || "OpenAI returned empty response"
    };
  }

  try {
    let jsonContent = result.responseContent;
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    const extraction: ExtractedKnowledge = JSON.parse(jsonContent);
    
    return {
      success: true,
      extraction,
      logId: result.logId
    };
  } catch (parseError) {
    console.error("[Learning Adapter] Failed to parse extraction response:", parseError);
    return {
      success: false,
      extraction: null,
      logId: result.logId,
      error: `Failed to parse response: ${parseError}`
    };
  }
}

async function findSimilarArticle(extraction: ExtractedKnowledge): Promise<{ articleId: number; score: number } | null> {
  if (!extraction.productStandard) return null;

  const articles = await knowledgeBaseStorage.getAllArticles({
    productStandard: extraction.productStandard,
  });

  if (articles.length === 0) return null;

  let bestMatch: { articleId: number; score: number } | null = null;
  
  for (const article of articles) {
    let score = 0;
    
    if (article.subproductStandard === extraction.subproductStandard) score += 25;
    if (article.category1 === extraction.category1) score += 25;
    if (article.category2 === extraction.category2) score += 25;
    
    if (extraction.description && article.description) {
      const descWords = extraction.description.toLowerCase().split(/\s+/);
      const articleWords = article.description.toLowerCase().split(/\s+/);
      const commonWords = descWords.filter(w => articleWords.includes(w));
      score += Math.min(25, (commonWords.length / Math.max(descWords.length, 1)) * 25);
    }
    
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { articleId: article.id, score: Math.round(score) };
    }
  }

  return bestMatch && bestMatch.score >= 50 ? bestMatch : null;
}

export async function extractAndSaveKnowledge(
  payload: LearningPayload,
  promptTemplate: string,
  modelName: string,
  conversationId: number,
  externalConversationId: string | null
): Promise<LearningResult> {
  const result = await extractKnowledge(
    payload,
    promptTemplate,
    modelName,
    conversationId,
    externalConversationId || undefined
  );

  if (!result.success || !result.extraction) {
    return result;
  }

  const extraction = result.extraction;

  if (!extraction.description && !extraction.resolution) {
    console.log(`[Learning Adapter] Skipping save - no meaningful content extracted for conversation ${conversationId}`);
    return {
      ...result,
      error: "No meaningful content extracted"
    };
  }

  const similarArticle = await findSimilarArticle(extraction);

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId,
    externalConversationId,
    productStandard: extraction.productStandard,
    subproductStandard: extraction.subproductStandard,
    category1: extraction.category1,
    category2: extraction.category2,
    description: extraction.description,
    resolution: extraction.resolution,
    observations: extraction.observations,
    confidenceScore: extraction.confidenceScore,
    qualityFlags: extraction.qualityFlags,
    similarArticleId: similarArticle?.articleId,
    similarityScore: similarArticle?.score,
    status: "pending",
    conversationHandler: payload.conversationHandler,
    rawExtraction: result.extraction,
  });

  console.log(`[Learning Adapter] Knowledge suggestion saved for conversation ${conversationId}, suggestionId: ${suggestion.id}, confidence: ${extraction.confidenceScore}`);

  return {
    ...result,
    suggestionId: suggestion.id,
    similarArticleId: similarArticle?.articleId,
    similarityScore: similarArticle?.score,
  };
}
