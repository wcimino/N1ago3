import { storage } from "../../../storage/index.js";
import { 
  replacePromptVariables, 
  formatMessagesContext, 
  formatLastMessage, 
  formatClassification, 
  formatProductsAndSubproducts,
  type PromptVariables,
  type ContentPayload 
} from "./promptUtils.js";
import { productCatalogStorage } from "../../products/storage/productCatalogStorage.js";
import { resolveProductById, resolveProductByName } from "./helpers/index.js";
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
    storage.getLast20MessagesForConversation(event.conversationId),
    options?.includeSummary !== false || options?.includeClassification !== false
      ? storage.getConversationSummary(event.conversationId)
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
    
  const productsContext = context.classification
    ? formatProductsAndSubproducts({
        product: context.classification.product ?? null,
        subproduct: context.classification.subproduct ?? null,
      })
    : 'Produto/Subproduto não disponível';

  let productsIdContext = 'IDs não disponíveis';
  if (context.classification?.product) {
    const resolved = await resolveProductByName(
      context.classification.product,
      context.classification.subproduct
    );
    if (resolved) {
      productsIdContext = `ID: ${resolved.id} (${resolved.fullName})`;
    }
  }

  let catalogoJson = '[]';
  try {
    catalogoJson = await getCachedProductCatalog();
  } catch {
    catalogoJson = '[]';
  }

  let searchResultsFormatted: string | null = null;
  if (context.searchResults && context.searchResults.length > 0) {
    searchResultsFormatted = context.searchResults
      .map(r => `- [${r.source}] ${r.name}: ${r.description}${r.matchScore ? ` (score: ${r.matchScore})` : ''}`)
      .join('\n');
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

  let produtoESubprodutoMatch: string | null = null;
  if (context.classification?.product) {
    const resolved = await resolveProductByName(
      context.classification.product,
      context.classification.subproduct
    );
    if (resolved) {
      const productScore = context.classification.productConfidence;
      produtoESubprodutoMatch = productScore != null 
        ? `${resolved.fullName} (score: ${productScore}%)`
        : resolved.fullName;
    }
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

  return {
    resumo: context.summary,
    resumoAtual: context.previousSummary ?? context.summary,
    productsAndSubproducts: productsContext,
    productsAndSubproductsId: productsIdContext,
    ultimas20Mensagens: messagesContext,
    ultimaMensagem: lastMessageContext,
    handler: context.handler,
    catalogoProdutosSubprodutos: catalogoJson,
    tipoSolicitacao: context.customerRequestType,
    demandaIdentificada: context.demand,
    resultadosBusca: searchResultsFormatted,
    artigosProblemasListaTop5,
    artigosProblemasListaTop10,
    produtoESubprodutoMatch,
    tipoDeDemandaMatch,
    artigoOuProblemaPrincipalMatch,
    customVariables: context.customVariables,
  };
}

export { type PromptVariables, type ContentPayload };
