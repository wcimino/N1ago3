import type { EventStandard } from "../../../../../shared/schema.js";

export const ORCHESTRATOR_STATUS = {
  NEW: "new",
  FINDING_DEMAND: "finding_demand",
  AWAITING_CUSTOMER_REPLY: "awaiting_customer_reply",
  DEMAND_CONFIRMED: "demand_confirmed",
  PROVIDING_SOLUTION: "providing_solution",
  COMPLETED: "completed",
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
  rootCauseId?: number;
  providedInputs?: Record<string, unknown>;
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
  rootCauseId?: number;
  providedInputs?: Record<string, unknown>;
  caseSolutionId?: number;
  demandFound?: boolean;
  actions?: OrchestratorAction[];
}

export type OrchestratorAction = 
  | { type: "SEND_MESSAGE"; payload: { suggestionId: number; responsePreview: string } }
  | { type: "TRANSFER_TO_HUMAN"; payload: { reason: string; message: string } };
