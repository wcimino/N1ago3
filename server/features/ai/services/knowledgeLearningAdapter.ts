import { callOpenAI } from "./openaiApiService.js";
import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";

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

### 2. SOLUÇÃO COMO INSTRUÇÃO FUTURA (CRÍTICO!)
A solução é uma INSTRUÇÃO para futuros atendimentos. NÃO é um relato do que aconteceu na conversa.

REGRA DE OURO: NUNCA use verbos no passado. SEMPRE use INFINITIVO ou IMPERATIVO.

❌ PROIBIDO (narrativa do passado):
- "Cliente foi orientado a..." → ERRADO, é relato
- "Foi explicado ao cliente que..." → ERRADO, é relato
- "O atendente informou sobre..." → ERRADO, é relato
- "Cliente foi orientada a acompanhar o banner" → ERRADO, é relato

✅ CORRETO (instrução para o futuro):
- "Orientar o cliente a..." → CERTO, é instrução
- "Explicar ao cliente que..." → CERTO, é instrução
- "Informar sobre..." → CERTO, é instrução
- "Direcionar o cliente para o banner de ofertas no app" → CERTO, é instrução

EXEMPLOS COMPLETOS DE SOLUÇÕES BOAS:
- "Orientar o cliente a acessar o app, clicar no banner de ofertas na tela inicial. O cartão é gratuito e sem anuidade. Prazo de aprovação: até 7 dias úteis. Se não visualizar o banner, verificar se o app está atualizado."
- "Solicitar envio de documentos: 1) CNH ou RG (frente e verso), 2) Comprovante de endereço (últimos 3 meses). Formatos aceitos: PDF ou JPG, máximo 5MB. Prazo de análise: até 48h."
- "Verificar no sistema se há saldo bloqueado. Informar que a antecipação é creditada em D+1. Se o valor não aparecer, abrir chamado para equipe de análise."

O QUE A SOLUÇÃO DEVE CONTER:
- Verbos no INFINITIVO (Orientar, Verificar, Solicitar, Informar)
- Passos específicos (menus, botões, telas)
- Requisitos e prazos
- O que fazer se não funcionar

### 3. OBSERVAÇÕES PARA DETALHES ADICIONAIS
- Use para exceções, casos especiais, ou contextos específicos
- Exemplo: "Clientes PJ precisam enviar contrato social ao invés de RG"

## IDENTIFICAÇÃO:
1. Produto principal (ex: Antecipação, Repasse, Conta Digital, Cartão)
2. Subproduto específico (ex: Receber Agora, Agenda de Recebíveis)
3. Categoria do problema (ex: Solicitação, Consulta, Reclamação, Cancelamento)
4. Subcategoria (ex: Valores, Prazo, Contratação)

## QUALIDADE:
- isComplete = false: se a solução for genérica ou não tiver passos claros
- isUncertain = true: se não conseguir extrair detalhes específicos da conversa
- possibleError = true: se a orientação parecer incorreta
- needsReview = true: se faltar informação importante ou precisar de mais detalhes

Retorne APENAS um JSON válido:
{
  "productStandard": "produto principal",
  "subproductStandard": "subproduto ou null",
  "category1": "categoria principal",
  "category2": "subcategoria ou null",
  "description": "descrição do problema (aplicável a qualquer cliente)",
  "resolution": "PASSO A PASSO DETALHADO com instruções específicas, menus, prazos, requisitos",
  "observations": "exceções, casos especiais, ou detalhes adicionais",
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
  if (!extraction.productStandard && !extraction.description) return null;

  const descriptionKeywords = extraction.description
    ?.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3) || [];

  const results = await knowledgeBaseService.findRelatedArticles(
    extraction.productStandard || undefined,
    extraction.category1 || undefined,
    descriptionKeywords,
    { limit: 1, minScore: 40 }
  );

  if (results.length === 0) return null;

  const bestMatch = results[0];
  return {
    articleId: bestMatch.article.id,
    score: bestMatch.relevanceScore
  };
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
