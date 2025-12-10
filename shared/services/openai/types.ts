export interface OpenAIConfig {
  apiKey: string;
  defaultModel?: string;
  defaultEmbeddingModel?: string;
}

export interface ChatParams {
  requestType: string;
  model?: string;
  promptSystem: string | null;
  promptUser: string;
  maxTokens?: number;
  correlationId?: string;
  contextType?: string;
  contextId?: string;
}

export interface ChatWithToolsParams extends ChatParams {
  tools: ToolDefinition[];
  maxIterations?: number;
  finalToolName?: string;
}

export interface EmbeddingParams {
  requestType: string;
  model?: string;
  input: string;
  correlationId?: string;
  contextType?: string;
  contextId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: any) => Promise<string>;
}

export interface ChatResult {
  success: boolean;
  logId: number;
  responseContent: string | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  tokensTotal: number | null;
  durationMs: number;
  error?: string;
  toolResult?: any;
  iterations?: number;
}

export interface EmbeddingResult {
  success: boolean;
  logId: number;
  embedding: number[] | null;
  tokensTotal: number | null;
  durationMs: number;
  error?: string;
}

export interface OpenAILogData {
  requestType: string;
  modelName: string;
  promptSystem: string | null;
  promptUser: string;
  responseRaw: any;
  responseContent: string | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  tokensTotal: number | null;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  contextType: string | null;
  contextId: string | null;
  correlationId?: string | null;
}
