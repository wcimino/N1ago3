import { storage } from "../../../storage/index.js";
import { runAgent, buildAgentContextFromEvent } from "./agentFramework.js";
import type { EventStandard } from "../../../../shared/schema.js";

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

export async function shouldGenerateSummary(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("summary");
  
  if (!config || !config.enabled) {
    return false;
  }

  if (!event.conversationId) {
    return false;
  }

  const triggerEventTypes = config.triggerEventTypes || [];
  const triggerAuthorTypes = config.triggerAuthorTypes || [];
  
  let eventTypeMatches = true;
  if (triggerEventTypes.length > 0) {
    const eventKey = `${event.source}:${event.eventType}`;
    const eventTypeOnly = event.eventType;
    eventTypeMatches = triggerEventTypes.includes(eventKey) || triggerEventTypes.includes(eventTypeOnly);
  }
  
  if (!eventTypeMatches) {
    return false;
  }

  if (triggerAuthorTypes.length === 0) {
    return true;
  }

  return triggerAuthorTypes.includes(event.authorType);
}

export async function generateConversationSummary(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Summary Orchestrator] Cannot generate summary: no conversationId");
    return;
  }

  try {
    const context = await buildAgentContextFromEvent(event, {
      includeSummary: true,
      includeClassification: false,
    });

    console.log(`[Summary Orchestrator] Generating summary for conversation ${event.conversationId} with ${context.messages?.length || 0} messages`);

    const result = await runAgent("summary", context);

    if (!result.success) {
      console.error(`[Summary Orchestrator] Failed to generate summary for conversation ${event.conversationId}: ${result.error}`);
      return;
    }

    if (!result.responseContent) {
      console.error(`[Summary Orchestrator] Empty response for conversation ${event.conversationId}`);
      return;
    }

    const structured = parseStructuredSummary(result.responseContent);

    await storage.upsertConversationSummary({
      conversationId: event.conversationId,
      externalConversationId: event.externalConversationId || undefined,
      summary: result.responseContent,
      clientRequest: structured?.clientRequest,
      agentActions: structured?.agentActions,
      currentStatus: structured?.currentStatus,
      importantInfo: structured?.importantInfo,
      customerEmotionLevel: structured?.customerEmotionLevel,
      customerRequestType: structured?.customerRequestType,
      objectiveProblems: structured?.objectiveProblems,
      articlesAndObjectiveProblems: structured?.articlesAndObjectiveProblems,
      lastEventId: event.id,
    });

    console.log(`[Summary Orchestrator] Summary saved for conversation ${event.conversationId}, logId: ${result.logId}`);
  } catch (error: any) {
    console.error(`[Summary Orchestrator] Error in generateConversationSummary for conversation ${event.conversationId}:`, error);
  }
}

export async function processSummaryForEvent(event: EventStandard): Promise<void> {
  const shouldGenerate = await shouldGenerateSummary(event);
  
  if (shouldGenerate) {
    await generateConversationSummary(event);
  }
}
