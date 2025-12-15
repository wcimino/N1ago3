import type { EventStandard } from "../../../../../shared/schema.js";

export const ORCHESTRATOR_STATUS = {
  NEW: "new",
  DEMAND_UNDERSTANDING: "demand_understanding",
  TEMP_DEMAND_UNDERSTOOD: "temp_demand_understood",
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
  };
  lastEventId?: number;
  externalConversationId?: string | null;
}

export interface ClassificationAgentResult extends AgentResult {
  productId?: number;
  customerRequestType?: string;
  productConfidence?: number;
  customerRequestTypeConfidence?: number;
}

export interface DemandFinderAgentResult extends AgentResult {
  searchResults?: Array<{
    source: string;
    id: number;
    name: string | null;
    description: string;
    matchScore?: number;
    matchReason?: string;
    matchedTerms?: string[];
    products?: string[];
  }>;
  suggestedResponse?: string;
  suggestionId?: number;
}

export interface SolutionProviderAgentResult extends AgentResult {
  resolved: boolean;
  solution?: string;
  confidence?: number;
  needsEscalation: boolean;
  escalationReason?: string;
  suggestedResponse?: string;
  suggestionId?: number;
}

export interface ArticlesAndSolutionsAgentResult extends AgentResult {
  searchResults?: Array<{
    source: string;
    id: number;
    name: string | null;
    description: string;
    matchScore?: number;
    matchReason?: string;
    matchedTerms?: string[];
    products?: string[];
  }>;
}

export interface OrchestratorContext {
  event: EventStandard;
  conversationId: number;
  currentStatus: OrchestratorStatus;
  summary?: string;
  classification?: {
    productId?: number;
    customerRequestType?: string;
    productConfidence?: number;
    customerRequestTypeConfidence?: number;
  };
  demand?: string;
  searchResults?: DemandFinderAgentResult["searchResults"];
}
