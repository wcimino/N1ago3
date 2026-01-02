export function createAgentLogger(agentName: string) {
  const prefix = `[${agentName}]`;

  return {
    info: (conversationId: number, message: string) => {
      console.log(`${prefix} ${message} for conversation ${conversationId}`);
    },
    warn: (conversationId: number, message: string) => {
      console.warn(`${prefix} WARNING: ${message} for conversation ${conversationId}`);
    },
    error: (conversationId: number, message: string, error?: any) => {
      console.error(`${prefix} Error for conversation ${conversationId}: ${message}`, error || "");
    },
    decision: (conversationId: number, decision: string, reason: string) => {
      console.log(`${prefix} AI decision: ${decision}, reason: ${reason}`);
    },
    action: (conversationId: number, action: string, details?: string) => {
      console.log(`${prefix} ${action} for conversation ${conversationId}${details ? `: ${details}` : ""}`);
    },
  };
}

export interface AgentProcessResult {
  success: boolean;
  demandConfirmed?: boolean;
  needsClarification?: boolean;
  maxInteractionsReached?: boolean;
  messageSent?: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export function createSuccessResult(overrides: Partial<AgentProcessResult> = {}): AgentProcessResult {
  return {
    success: true,
    demandConfirmed: false,
    needsClarification: false,
    maxInteractionsReached: false,
    messageSent: false,
    ...overrides,
  };
}
