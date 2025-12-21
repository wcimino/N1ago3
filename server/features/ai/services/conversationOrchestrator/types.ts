import type { EventStandard } from "../../../../../shared/schema.js";

export const CONVERSATION_OWNER = {
  DEMAND_FINDER: "demand_finder",
  CLOSER: "closer",
} as const;

export type ConversationOwner = typeof CONVERSATION_OWNER[keyof typeof CONVERSATION_OWNER];

const VALID_OWNER_TRANSITIONS: Record<ConversationOwner | "null", (ConversationOwner | null)[]> = {
  "null": [CONVERSATION_OWNER.DEMAND_FINDER],
  [CONVERSATION_OWNER.DEMAND_FINDER]: [CONVERSATION_OWNER.CLOSER, null],
  [CONVERSATION_OWNER.CLOSER]: [CONVERSATION_OWNER.DEMAND_FINDER, null],
};

export function isValidOwnerTransition(
  from: ConversationOwner | null,
  to: ConversationOwner | null
): boolean {
  if (from === to) return true;
  
  const fromKey = from === null ? "null" : from;
  const allowedTransitions = VALID_OWNER_TRANSITIONS[fromKey];
  
  if (!allowedTransitions) {
    return false;
  }
  
  return allowedTransitions.includes(to);
}

export interface DispatchResult {
  success: boolean;
  newOwner: ConversationOwner | null;
  shouldContinue: boolean;
  error?: string;
}

export const ORCHESTRATOR_STATUS = {
  NEW: "new",
  FINDING_DEMAND: "finding_demand",
  FINALIZING: "finalizing",
  CLOSED: "closed",
  ESCALATED: "escalated",
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
    id: string;
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

export interface CloserAgentResult extends AgentResult {
  wantsMoreHelp: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
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
  lastDispatchLog?: {
    solutionCenterResults: number;
    aiDecision: string | null;
    aiReason: string | null;
    action: string;
    details?: Record<string, unknown>;
  };
}

export type OrchestratorAction = 
  | { type: "SEND_MESSAGE"; payload: { suggestionId: number; responsePreview: string } }
  | { type: "TRANSFER_TO_HUMAN"; payload: { reason: string; message: string } };
