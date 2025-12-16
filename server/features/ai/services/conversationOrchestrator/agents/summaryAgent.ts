import { storage } from "../../../../../storage/index.js";
import { runAgent, buildAgentContextFromEvent } from "../../agentFramework.js";
import type { SummaryAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "summary";

interface ObjectiveProblemResult {
  id: number;
  name: string;
  matchScore?: number;
  matchedTerms?: string[];
}

interface ClientRequestVersions {
  clientRequestStandardVersion?: string;
  clientRequestQuestionVersion?: string;
  clientRequestProblemVersion?: string;
}

interface StructuredSummary {
  clientRequest?: string;
  clientRequestVersions?: ClientRequestVersions;
  agentActions?: string;
  currentStatus?: string;
  importantInfo?: string;
  customerEmotionLevel?: number;
  objectiveProblems?: ObjectiveProblemResult[];
}

export class SummaryAgent {
  static async process(context: OrchestratorContext): Promise<SummaryAgentResult> {
    const { event, conversationId } = context;

    try {
      const shouldGenerate = await this.shouldGenerate(event);
      
      if (!shouldGenerate) {
        console.log(`[SummaryAgent] Skipping summary generation for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      console.log(`[SummaryAgent] Generating summary for conversation ${conversationId}`);

      const agentContext = await buildAgentContextFromEvent(event, {
        includeSummary: true,
        includeClassification: false,
      });

      const result = await runAgent(CONFIG_KEY, agentContext);

      if (!result.success) {
        console.error(`[SummaryAgent] Failed to generate summary for conversation ${conversationId}: ${result.error}`);
        return {
          success: false,
          error: result.error || "Failed to generate summary",
        };
      }

      if (!result.responseContent) {
        console.log(`[SummaryAgent] Empty response for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      const structured = this.parseStructuredSummary(result.responseContent);

      await storage.upsertConversationSummary({
        conversationId,
        externalConversationId: event.externalConversationId || undefined,
        summary: result.responseContent,
        clientRequest: structured?.clientRequest,
        clientRequestVersions: structured?.clientRequestVersions,
        agentActions: structured?.agentActions,
        currentStatus: structured?.currentStatus,
        importantInfo: structured?.importantInfo,
        customerEmotionLevel: structured?.customerEmotionLevel,
        objectiveProblems: structured?.objectiveProblems,
        lastEventId: event.id,
      });

      console.log(`[SummaryAgent] Summary generated for conversation ${conversationId}, logId: ${result.logId}`);

      return {
        success: true,
        summary: result.responseContent,
        structured: structured ? {
          clientRequest: structured.clientRequest,
          agentActions: structured.agentActions,
          currentStatus: structured.currentStatus,
          importantInfo: structured.importantInfo,
          customerEmotionLevel: structured.customerEmotionLevel,
          customerRequestType: undefined,
          objectiveProblems: structured.objectiveProblems,
        } : undefined,
        lastEventId: event.id,
        externalConversationId: event.externalConversationId,
      };
    } catch (error: any) {
      console.error(`[SummaryAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate summary",
      };
    }
  }

  private static async shouldGenerate(event: OrchestratorContext["event"]): Promise<boolean> {
    const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
    
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

  private static parseStructuredSummary(responseContent: string): StructuredSummary | null {
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
          .map((p: any) => {
            const rawMatchedTerms = p.matchedTerms || p.matched_terms || p.termosCorrespondentes || p.termos_correspondentes;
            let matchedTerms: string[] | undefined;
            if (Array.isArray(rawMatchedTerms)) {
              matchedTerms = rawMatchedTerms.filter((t: any) => typeof t === 'string' && t.trim());
            } else if (typeof rawMatchedTerms === 'string' && rawMatchedTerms.trim()) {
              matchedTerms = rawMatchedTerms.split(/[,;]+/).map((t: string) => t.trim()).filter(Boolean);
            }
            return {
              id: p.id,
              name: p.name,
              matchScore: typeof p.matchScore === 'number' ? p.matchScore : (typeof p.match_score === 'number' ? p.match_score : undefined),
              matchedTerms: matchedTerms && matchedTerms.length > 0 ? matchedTerms : undefined,
            };
          });
        if (objectiveProblems.length === 0) objectiveProblems = undefined;
      }

      let clientRequestVersions: ClientRequestVersions | undefined;
      const rawVersions = parsed.clientRequestVersions || parsed.client_request_versions;
      if (rawVersions && typeof rawVersions === 'object') {
        clientRequestVersions = {
          clientRequestStandardVersion: rawVersions.clientRequestStandardVersion || rawVersions.client_request_standard_version || undefined,
          clientRequestQuestionVersion: rawVersions.clientRequestQuestionVersion || rawVersions.client_request_question_version || undefined,
          clientRequestProblemVersion: rawVersions.clientRequestProblemVersion || rawVersions.client_request_problem_version || undefined,
        };
        if (!clientRequestVersions.clientRequestStandardVersion && 
            !clientRequestVersions.clientRequestQuestionVersion && 
            !clientRequestVersions.clientRequestProblemVersion) {
          clientRequestVersions = undefined;
        }
      }

      return {
        clientRequest: parsed.clientRequest || parsed.solicitacaoCliente || parsed.solicitacao_cliente || undefined,
        clientRequestVersions,
        agentActions: parsed.agentActions || parsed.acoesAtendente || parsed.acoes_atendente || undefined,
        currentStatus: parsed.currentStatus || parsed.statusAtual || parsed.status_atual || undefined,
        importantInfo: parsed.importantInfo || parsed.informacoesImportantes || parsed.informacoes_importantes || undefined,
        customerEmotionLevel: validEmotionLevel,
        objectiveProblems,
      };
    } catch {
      return null;
    }
  }
}
