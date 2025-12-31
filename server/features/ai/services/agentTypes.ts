import type { ContentPayload } from "./promptUtils.js";
import type { ClientHubData } from "../../../../shared/schema/clientHub.js";

export interface AgentContext {
  conversationId: number;
  externalConversationId?: string | null;
  lastEventId?: number;
  summary?: string | null;
  previousSummary?: string | null;
  classification?: {
    product?: string | null;
    subproduct?: string | null;
    customerRequestType?: string | null;
    productConfidence?: number | null;
    customerRequestTypeConfidence?: number | null;
  } | null;
  handler?: string | null;
  customerRequestType?: string | null;
  demand?: string | null;
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
  clientHubData?: ClientHubData | null;
  customVariables?: Record<string, string>;
}

export interface AgentRunnerResult {
  success: boolean;
  responseContent: string | null;
  parsedContent: any;
  logId: number;
  toolResult?: any;
  error?: string;
}

export interface AgentRunOptions {
  skipIfDisabled?: boolean;
  defaultModelName?: string;
  maxIterations?: number;
  finalToolName?: string;
}

export interface AgentSuggestionOptions extends AgentRunOptions {
  suggestionField?: string;
  inResponseTo?: string | null;
}

export interface SaveSuggestionOptions {
  externalConversationId?: string | null;
  lastEventId?: number;
  openaiLogId?: number;
  inResponseTo?: string | null;
  articlesUsed?: Array<{ id: number; name: string; product: string; url?: string }>;
  source?: string;
}

export interface ActionInfo {
  description: string;
  value: string | null;
  instructions: string | null;
  requiresResponse: boolean;
}

export interface BuildContextOptions {
  includeLastMessage?: boolean;
  includeSummary?: boolean;
  includeClassification?: boolean;
  overrides?: Partial<Pick<AgentContext, 'summary' | 'classification' | 'demand' | 'searchResults' | 'handler' | 'customerRequestType'>> & {
    actionInfo?: ActionInfo;
  };
}
