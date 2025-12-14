import { storage } from "../../../storage/index.js";
import { callOpenAI } from "./openaiApiService.js";
import { generalSettingsStorage } from "../storage/generalSettingsStorage.js";
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
import type { OpenaiApiConfig, EventStandard } from "../../../../shared/schema.js";
import type { ToolFlags } from "./aiTools.js";
import memoize from "memoizee";

const getCachedProductCatalog = memoize(
  async () => {
    const catalog = await productCatalogStorage.getAllProducts();
    return JSON.stringify(catalog.map(p => ({
      name: p.name,
      subproducts: p.subproducts,
    })));
  },
  { maxAge: 5 * 60 * 1000, promise: true }
);

export interface AgentContext {
  conversationId: number;
  externalConversationId?: string | null;
  lastEventId?: number;
  summary?: string | null;
  previousSummary?: string | null;
  classification?: {
    product?: string | null;
    subproduct?: string | null;
    subject?: string | null;
    intent?: string | null;
    confidence?: number | null;
  } | null;
  handler?: string | null;
  customerRequestType?: string | null;
  demand?: string | null;
  searchResults?: Array<{
    source: string;
    id: number;
    name: string;
    description: string;
    matchScore?: number;
  }>;
  messages?: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  }>;
  lastMessage?: {
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
    eventSubtype?: string | null;
    contentPayload?: ContentPayload | null;
  };
}

export interface AgentRunnerResult {
  success: boolean;
  responseContent: string | null;
  parsedContent: any;
  logId: number;
  toolResult?: any;
  error?: string;
}

function extractToolFlags(config: OpenaiApiConfig): ToolFlags {
  return {
    useKnowledgeBaseTool: config.useKnowledgeBaseTool ?? false,
    useProductCatalogTool: config.useProductCatalogTool ?? false,
    useSubjectIntentTool: config.useSubjectIntentTool ?? false,
    useZendeskKnowledgeBaseTool: config.useZendeskKnowledgeBaseTool ?? false,
    useObjectiveProblemTool: config.useObjectiveProblemTool ?? false,
    useCombinedKnowledgeSearchTool: config.useCombinedKnowledgeSearchTool ?? false,
    useKnowledgeSuggestionTool: config.useKnowledgeSuggestionTool ?? false,
  };
}

export async function buildAgentContextFromEvent(
  event: EventStandard,
  options?: {
    includeLastMessage?: boolean;
    includeSummary?: boolean;
    includeClassification?: boolean;
    overrides?: Partial<Pick<AgentContext, 'summary' | 'classification' | 'demand' | 'searchResults' | 'handler' | 'customerRequestType'>>;
  }
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

  const classification = options?.includeClassification !== false && existingSummary
    ? {
        product: existingSummary.product,
        subproduct: existingSummary.subproduct,
        subject: existingSummary.subject,
        intent: existingSummary.intent,
        confidence: existingSummary.confidence,
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

async function buildPromptVariables(context: AgentContext): Promise<PromptVariables> {
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
        subject: context.classification.subject ?? null,
        intent: context.classification.intent ?? null,
        confidence: context.classification.confidence ?? null,
      })
    : 'Classificação não disponível';
    
  const productsContext = context.classification
    ? formatProductsAndSubproducts({
        product: context.classification.product ?? null,
        subproduct: context.classification.subproduct ?? null,
      })
    : 'Produto/Subproduto não disponível';

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

  return {
    resumo: context.summary,
    resumoAtual: context.previousSummary ?? context.summary,
    classificacao: classificationContext,
    productsAndSubproducts: productsContext,
    ultimas20Mensagens: messagesContext,
    ultimaMensagem: lastMessageContext,
    mensagens: messagesContext,
    handler: context.handler,
    catalogoProdutosSubprodutos: catalogoJson,
    tipoSolicitacao: context.customerRequestType,
    demandaIdentificada: context.demand,
    resultadosBusca: searchResultsFormatted,
  };
}

export async function runAgent(
  configType: string,
  context: AgentContext,
  options?: {
    skipIfDisabled?: boolean;
    defaultModelName?: string;
    maxIterations?: number;
    finalToolName?: string;
  }
): Promise<AgentRunnerResult> {
  const config = await storage.getOpenaiApiConfig(configType);
  
  if (!config) {
    console.log(`[AgentFramework] No config found for ${configType}`);
    return {
      success: false,
      responseContent: null,
      parsedContent: {},
      logId: 0,
      error: `Configuration for '${configType}' not found`,
    };
  }

  if (options?.skipIfDisabled && !config.enabled) {
    console.log(`[AgentFramework] Agent ${configType} is disabled`);
    return {
      success: true,
      responseContent: null,
      parsedContent: {},
      logId: 0,
    };
  }

  let effectivePromptSystem = config.promptSystem || "";
  if (config.useGeneralSettings) {
    const generalSettings = await generalSettingsStorage.getConcatenatedContent();
    if (generalSettings) {
      effectivePromptSystem = generalSettings + "\n\n" + effectivePromptSystem;
    }
  }

  const variables = await buildPromptVariables(context);

  const promptTemplate = config.promptTemplate || "";
  const userPrompt = replacePromptVariables(promptTemplate, variables);

  let fullUserPrompt = userPrompt;
  if (config.responseFormat) {
    fullUserPrompt += `\n\n## Formato da Resposta\n${config.responseFormat}`;
  }

  const toolFlags = extractToolFlags(config);

  const effectiveFinalToolName = options?.finalToolName ?? 
    (toolFlags.useKnowledgeSuggestionTool ? "create_knowledge_suggestion" : undefined);

  console.log(`[AgentFramework] Running ${configType} for conversation ${context.conversationId}`);

  const response = await callOpenAI({
    requestType: configType,
    modelName: config.modelName || options?.defaultModelName || "gpt-4o-mini",
    promptSystem: effectivePromptSystem,
    promptUser: fullUserPrompt,
    contextType: "conversation",
    contextId: context.externalConversationId || String(context.conversationId),
    toolFlags,
    maxIterations: options?.maxIterations,
    finalToolName: effectiveFinalToolName,
  });

  if (!response.success) {
    return {
      success: false,
      responseContent: null,
      parsedContent: {},
      logId: response.logId,
      error: response.error || "Failed to call OpenAI",
    };
  }

  let parsedContent: any = {};
  if (response.responseContent) {
    try {
      parsedContent = JSON.parse(response.responseContent);
    } catch {
      parsedContent = { rawResponse: response.responseContent };
    }
  }

  return {
    success: true,
    responseContent: response.responseContent,
    parsedContent,
    logId: response.logId,
    toolResult: response.toolResult,
  };
}

export async function saveSuggestedResponse(
  conversationId: number,
  suggestedResponse: string,
  options: {
    externalConversationId?: string | null;
    lastEventId?: number;
    openaiLogId?: number;
    inResponseTo?: string | null;
    articlesUsed?: Array<{ id: number; name: string; product: string; url?: string }>;
    source?: string;
  }
): Promise<{ id: number } | null> {
  try {
    const savedSuggestion = await storage.saveSuggestedResponse(conversationId, {
      suggestedResponse,
      lastEventId: options.lastEventId,
      openaiLogId: options.openaiLogId,
      externalConversationId: options.externalConversationId ?? null,
      inResponseTo: options.inResponseTo ?? null,
      articlesUsed: options.articlesUsed,
    });

    console.log(`[AgentFramework] Saved suggested response for conversation ${conversationId}, id: ${savedSuggestion.id}`);

    return { id: savedSuggestion.id };
  } catch (error: any) {
    console.error(`[AgentFramework] Failed to save suggested response:`, error);
    return null;
  }
}

export async function runAgentAndSaveSuggestion(
  configType: string,
  context: AgentContext,
  options?: {
    skipIfDisabled?: boolean;
    defaultModelName?: string;
    maxIterations?: number;
    finalToolName?: string;
    suggestionField?: string;
    inResponseTo?: string | null;
  }
): Promise<AgentRunnerResult & { suggestionId?: number }> {
  const result = await runAgent(configType, context, options);

  if (!result.success) {
    return result;
  }

  const suggestionField = options?.suggestionField || "suggestedAnswerToCustomer";
  const suggestedResponse = result.parsedContent?.[suggestionField];

  if (suggestedResponse && typeof suggestedResponse === "string" && suggestedResponse.trim()) {
    const saved = await saveSuggestedResponse(context.conversationId, suggestedResponse, {
      externalConversationId: context.externalConversationId,
      lastEventId: context.lastEventId,
      openaiLogId: result.logId,
      inResponseTo: options?.inResponseTo,
    });

    return {
      ...result,
      suggestionId: saved?.id,
    };
  }

  return result;
}

export { type PromptVariables, type ContentPayload };
