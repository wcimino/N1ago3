import type { EventStandard } from "../../../../../shared/schema.js";

export const ORCHESTRATOR_STATUS = {
  NEW: "new",
  DEMAND_UNDERSTANDING: "demand_understanding",
  DEMAND_RESOLVING: "demand_resolving",
  ESCALATED: "escalated",
  CLOSED: "closed",
} as const;

export type OrchestratorStatus = typeof ORCHESTRATOR_STATUS[keyof typeof ORCHESTRATOR_STATUS];

export interface AgentResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface SummaryAgentResult extends AgentResult {
  summary?: string;
  structured?: {
    clientRequest?: string;
    agentActions?: string;
    currentStatus?: string;
    importantInfo?: string;
    customerEmotionLevel?: number;
    customerRequestType?: string;
    objectiveProblems?: Array<{ id: number; name: string; matchScore?: number }>;
    articlesAndObjectiveProblems?: Array<{
      source: "article" | "problem";
      id: number;
      name: string | null;
      description: string;
      resolution?: string;
      matchScore?: number;
      matchReason?: string;
      products?: string[];
    }>;
  };
  lastEventId?: number;
  externalConversationId?: string | null;
}

export interface ClassificationAgentResult extends AgentResult {
  product?: string;
  subject?: string;
  intent?: string;
}

export interface DemandFinderAgentResult extends AgentResult {
  demandIdentified: boolean;
  demand?: string;
  searchResults?: Array<{
    source: string;
    id: number;
    name: string;
    description: string;
    matchScore?: number;
  }>;
  needsMoreInfo?: boolean;
  followUpQuestion?: string;
}

export interface SolutionProviderAgentResult extends AgentResult {
  resolved: boolean;
  solution?: string;
  confidence?: number;
  needsEscalation: boolean;
  escalationReason?: string;
  suggestedResponse?: string;
}

export interface OrchestratorContext {
  event: EventStandard;
  conversationId: number;
  currentStatus: OrchestratorStatus;
  summary?: string;
  classification?: {
    product?: string;
    subject?: string;
    intent?: string;
  };
  demand?: string;
  searchResults?: DemandFinderAgentResult["searchResults"];
}
