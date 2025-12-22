import {
  chat,
  chatWithTools,
  type ChatParams,
  type ChatWithToolsParams,
  type ChatResult,
  type ToolDefinition,
} from "../../../../shared/services/openai/index.js";
import { storage } from "../../../storage/index.js";
import type { OpenaiApiLog } from "../../../../shared/schema.js";

export type { ToolDefinition };

export interface OpenAICallParams {
  requestType: string;
  modelName: string;
  promptSystem: string | null;
  promptUser: string;
  maxTokens?: number;
  contextType?: string;
  contextId?: string;
  tools?: ToolDefinition[];
  maxIterations?: number;
  finalToolName?: string;
}

export interface OpenAICallResult {
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

export async function callOpenAI(params: OpenAICallParams): Promise<OpenAICallResult> {
  const tools = params.tools || [];

  if (tools.length > 0) {
    const result = await chatWithTools({
      requestType: params.requestType,
      model: params.modelName,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      maxTokens: params.maxTokens,
      contextType: params.contextType,
      contextId: params.contextId,
      tools,
      maxIterations: params.maxIterations,
      finalToolName: params.finalToolName,
    });

    return result;
  }

  const result = await chat({
    requestType: params.requestType,
    model: params.modelName,
    promptSystem: params.promptSystem,
    promptUser: params.promptUser,
    maxTokens: params.maxTokens,
    contextType: params.contextType,
    contextId: params.contextId,
  });

  return result;
}

export async function getOpenaiLogs(limit: number = 100, requestType?: string): Promise<OpenaiApiLog[]> {
  return storage.getOpenaiApiLogs(limit, requestType);
}

export async function getOpenaiLogById(id: number): Promise<OpenaiApiLog | null> {
  return storage.getOpenaiApiLogById(id);
}
