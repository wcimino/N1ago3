import OpenAI from "openai";
import { storage } from "../storage.js";
import type { OpenaiApiLog } from "../../shared/schema.js";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured. Please add your OpenAI API key.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface OpenAICallParams {
  requestType: string;
  modelName: string;
  promptSystem: string | null;
  promptUser: string;
  maxTokens?: number;
  contextType?: string;
  contextId?: string;
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
}

export async function callOpenAI(params: OpenAICallParams): Promise<OpenAICallResult> {
  const startTime = Date.now();
  
  try {
    const openai = getOpenAIClient();
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (params.promptSystem) {
      messages.push({
        role: "system",
        content: params.promptSystem
      });
    }
    
    messages.push({
      role: "user",
      content: params.promptUser
    });

    const response = await openai.chat.completions.create({
      model: params.modelName,
      messages,
      max_completion_tokens: params.maxTokens || 1024,
    });

    const durationMs = Date.now() - startTime;
    const responseContent = response.choices[0]?.message?.content || null;
    const usage = response.usage;

    const log = await storage.saveOpenaiApiLog({
      requestType: params.requestType,
      modelName: params.modelName,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      responseRaw: response as any,
      responseContent,
      tokensPrompt: usage?.prompt_tokens || null,
      tokensCompletion: usage?.completion_tokens || null,
      tokensTotal: usage?.total_tokens || null,
      durationMs,
      success: true,
      errorMessage: null,
      contextType: params.contextType || null,
      contextId: params.contextId || null,
    });

    console.log(`[OpenAI API] ${params.requestType} - Model: ${params.modelName}, Tokens: ${usage?.total_tokens || 0}, Duration: ${durationMs}ms`);

    return {
      success: true,
      logId: log.id,
      responseContent,
      tokensPrompt: usage?.prompt_tokens || null,
      tokensCompletion: usage?.completion_tokens || null,
      tokensTotal: usage?.total_tokens || null,
      durationMs,
    };

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error.message || String(error);

    const log = await storage.saveOpenaiApiLog({
      requestType: params.requestType,
      modelName: params.modelName,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      responseRaw: null,
      responseContent: null,
      tokensPrompt: null,
      tokensCompletion: null,
      tokensTotal: null,
      durationMs,
      success: false,
      errorMessage,
      contextType: params.contextType || null,
      contextId: params.contextId || null,
    });

    console.error(`[OpenAI API] ${params.requestType} FAILED - Error: ${errorMessage}, Duration: ${durationMs}ms`);

    return {
      success: false,
      logId: log.id,
      responseContent: null,
      tokensPrompt: null,
      tokensCompletion: null,
      tokensTotal: null,
      durationMs,
      error: errorMessage,
    };
  }
}

export async function getOpenaiLogs(limit: number = 100, requestType?: string): Promise<OpenaiApiLog[]> {
  return storage.getOpenaiApiLogs(limit, requestType);
}

export async function getOpenaiLogById(id: number): Promise<OpenaiApiLog | null> {
  return storage.getOpenaiApiLogById(id);
}
