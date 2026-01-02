import { eventStorage } from "../../events/storage/eventStorage.js";
import { summaryStorage } from "../storage/summaryStorage.js";
import { 
  replacePromptVariables, 
  formatMessagesContext, 
  formatLastMessage, 
  formatClassification,
  type PromptVariables,
  type ContentPayload 
} from "./promptUtils.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { caseSolutionStorage } from "../storage/caseSolutionStorage.js";
import { caseDemandStorage } from "../storage/caseDemandStorage.js";
import { resolveProductById, resolveProductByName } from "./helpers/productHelpers.js";
import type { EventStandard } from "../../../../shared/schema.js";
import type { AgentContext, BuildContextOptions } from "./agentTypes.js";
import memoize from "memoizee";

const getCachedProductCatalog = memoize(
  async () => {
    const catalog = await productCatalogStorage.getAll();
    return JSON.stringify(catalog.map(p => ({
      produto: p.produto,
      subproduto: p.subproduto,
    })));
  },
  { maxAge: 5 * 60 * 1000, promise: true }
);

export async function buildAgentContextFromEvent(
  event: EventStandard,
  options?: BuildContextOptions
): Promise<AgentContext> {
  if (!event.conversationId) {
    throw new Error("Cannot build context: no conversationId in event");
  }

  const [last20Messages, existingSummary] = await Promise.all([
    eventStorage.getLast20MessagesForConversation(event.conversationId),
    options?.includeSummary !== false || options?.includeClassification !== false
      ? summaryStorage.getConversationSummary(event.conversationId)
      : null,
  ]);

  const reversedMessages = [...last20Messages].reverse();

  let classificationProduct: string | null = null;
  let classificationSubproduct: string | null = null;
  
  if (options?.includeClassification !== false && existingSummary?.productId) {
    const resolvedProduct = await resolveProductById(existingSummary.productId);
    if (resolvedProduct) {
      classificationProduct = resolvedProduct.produto;
      classificationSubproduct = resolvedProduct.subproduto;
    }
  }

  const classification = options?.includeClassification !== false && existingSummary
    ? {
        product: classificationProduct,
        subproduct: classificationSubproduct,
        customerRequestType: existingSummary.customerRequestType,
        productConfidence: existingSummary.productConfidence,
        customerRequestTypeConfidence: existingSummary.customerRequestTypeConfidence,
      }
    : null;

  const context: AgentContext = {
    conversationId: event.conversationId,
    externalConversationId: event.externalConversationId,
    lastEventId: event.id,
    summary: options?.overrides?.summary ?? (options?.includeSummary !== false ? existingSummary?.summary || null : null),
    previousSummary: existingSummary?.summary || null,
    classification: options?.overrides?.classification 
      ? { ...classification, ...options.overrides.classification }
      : classification,
    demand: options?.overrides?.demand,
    searchResults: options?.overrides?.searchResults,
    handler: options?.overrides?.handler,
    customerRequestType: options?.overrides?.customerRequestType,
    messages: reversedMessages.map(m => ({
      authorType: m.authorType,
      authorName: m.authorName,
      contentText: m.contentText,
      occurredAt: m.occurredAt,
      eventSubtype: m.eventSubtype,
      contentPayload: m.contentPayload as ContentPayload | null,
    })),
    clientHubData: existingSummary?.clientHubData || null,
  };

  if (options?.includeLastMessage !== false) {
    context.lastMessage = {
      authorType: event.authorType,
      authorName: event.authorName,
      contentText: event.contentText,
      occurredAt: event.occurredAt,
      eventSubtype: event.eventSubtype,
      contentPayload: event.contentPayload as ContentPayload | null,
    };
  }

  return context;
}

export async function buildPromptVariables(context: AgentContext): Promise<PromptVariables> {
  const messagesContext = context.messages 
    ? formatMessagesContext(context.messages)
    : 'Nenhuma mensagem disponível.';
    
  const lastMessageContext = context.lastMessage 
    ? formatLastMessage(context.lastMessage)
    : '';
    
  const classificationContext = context.classification 
    ? formatClassification({
        product: context.classification.product ?? null,
        subproduct: context.classification.subproduct ?? null,
        customerRequestType: context.classification.customerRequestType ?? null,
      })
    : 'Classificação não disponível';
    
  const produtoNome = context.classification?.product ?? null;
  const subprodutoNome = context.classification?.subproduct ?? null;
  const produtoScore = context.classification?.productConfidence ?? null;
  const tipoSolicitacaoNome = context.customerRequestType || (context.classification?.customerRequestType ?? null);
  const tipoSolicitacaoScore = context.classification?.customerRequestTypeConfidence ?? null;
  
  const produtoJson = JSON.stringify({ nome: produtoNome, score: produtoScore });
  const subprodutoJson = JSON.stringify({ nome: subprodutoNome, score: null });
  const tipoSolicitacaoJson = JSON.stringify({ nome: tipoSolicitacaoNome, score: tipoSolicitacaoScore });
  const clientePerfilJson = context.clientHubData ? JSON.stringify(context.clientHubData) : null;
  
  let produtoESubprodutoNome: string | null = null;
  if (produtoNome) {
    produtoESubprodutoNome = subprodutoNome 
      ? `${produtoNome} / ${subprodutoNome}`
      : produtoNome;
  }

  let catalogoJson = '[]';
  try {
    catalogoJson = await getCachedProductCatalog();
  } catch {
    catalogoJson = '[]';
  }

  let artigosProblemasListaTop5: string | null = null;
  let artigosProblemasListaTop10: string | null = null;
  
  // Se searchResults já foram fornecidos no contexto, usar diretamente (evita busca duplicada)
  if (context.searchResults && context.searchResults.length > 0) {
    const formattedResults5 = context.searchResults.slice(0, 5).map(r => ({
      tipo: "problema",
      id: r.id,
      nome: r.name || r.description,
      descricao: r.description,
      score: r.matchScore || 0,
      matched_terms: r.matchedTerms || []
    }));
    artigosProblemasListaTop5 = JSON.stringify(formattedResults5, null, 2);
    
    const formattedResults10 = context.searchResults.slice(0, 10).map(r => ({
      tipo: "problema",
      id: r.id,
      nome: r.name || r.description,
      descricao: r.description,
      score: r.matchScore || 0,
      matched_terms: r.matchedTerms || []
    }));
    artigosProblemasListaTop10 = JSON.stringify(formattedResults10, null, 2);
  }

  let tipoDeDemandaMatch: string | null = null;
  const demandType = context.customerRequestType || context.classification?.customerRequestType;
  if (demandType) {
    const demandScore = context.classification?.customerRequestTypeConfidence;
    tipoDeDemandaMatch = demandScore != null 
      ? `${demandType} (score: ${demandScore}%)`
      : demandType;
  }

  let artigoOuProblemaPrincipalMatch: string | null = null;
  if (context.searchResults && context.searchResults.length > 0) {
    const topResult = context.searchResults[0];
    artigoOuProblemaPrincipalMatch = `[${topResult.source}] ${topResult.name}${topResult.matchScore != null ? ` (score: ${topResult.matchScore})` : ''}`;
  }

  let solucaoAcoes: string | null = null;
  let solucaoId: string | null = null;
  let solucaoNome: string | null = null;
  let solucaoDescricao: string | null = null;

  if (context.conversationId) {
    try {
      const caseDemand = await caseDemandStorage.getActiveByConversationId(context.conversationId);
      if (caseDemand) {
        solucaoId = caseDemand.solutionCenterArticleAndProblemsIdSelected || null;
        
        try {
          const rawResponse = caseDemand.demandFinderAiResponse;
          const aiResponse: { 
            selected_intent?: { id?: string; label?: string }; 
            reason?: string 
          } | null = typeof rawResponse === 'string' 
            ? JSON.parse(rawResponse) 
            : rawResponse;
          
          if (aiResponse) {
            solucaoNome = aiResponse.selected_intent?.label || null;
            solucaoDescricao = aiResponse.reason || null;
          }
        } catch (parseError) {
          console.error('[buildPromptVariables] Error parsing demandFinderAiResponse:', parseError);
        }
      }

      const caseSolution = await caseSolutionStorage.getActiveByConversationId(context.conversationId);
      if (caseSolution) {
        const actions = await caseSolutionStorage.getActions(caseSolution.id);
        if (actions.length > 0) {
          const formattedActions = actions.map(action => ({
            id: action.id,
            externalActionId: action.externalActionId,
            sequence: action.actionSequence,
            status: action.status,
            input: action.inputUsed,
          }));
          solucaoAcoes = JSON.stringify(formattedActions, null, 2);
        }
      }
    } catch (error) {
      console.error('[buildPromptVariables] Error fetching solution data:', error);
    }
  }

  return {
    resumo: context.summary,
    ultimas20Mensagens: messagesContext,
    ultimaMensagem: lastMessageContext,
    handler: context.handler,
    produtosESubprodutosCatalogo: catalogoJson,
    tipoSolicitacao: context.customerRequestType,
    demandaIdentificada: context.demand,
    artigosProblemasListaTop5,
    artigosProblemasListaTop10,
    tipoDeDemandaMatch,
    artigoOuProblemaPrincipalMatch,
    produtoNome,
    subprodutoNome,
    produtoESubprodutoNome,
    produtoJson,
    subprodutoJson,
    tipoSolicitacaoJson,
    clientePerfilJson,
    solucaoId,
    solucaoNome,
    solucaoDescricao,
    solucaoAcoes,
    sugestaoResposta: context.sugestaoResposta,
    customVariables: context.customVariables,
  };
}

export { type PromptVariables, type ContentPayload };
