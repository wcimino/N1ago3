import OpenAI from "openai";
import { storage } from "../../../storage/index.js";
import type { OpenaiApiLog } from "../../../../shared/schema.js";
import { buildToolsFromFlags, type ToolFlags } from "./aiTools.js";

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

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: any) => Promise<string>;
}

export interface OpenAICallParams {
  requestType: string;
  modelName: string;
  promptSystem: string | null;
  promptUser: string;
  maxTokens?: number;
  contextType?: string;
  contextId?: string;
  tools?: ToolDefinition[];
  toolFlags?: ToolFlags;
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
  const startTime = Date.now();
  
  let tools = params.tools || [];
  if (params.toolFlags) {
    const flagTools = buildToolsFromFlags(params.toolFlags);
    tools = [...tools, ...flagTools];
  }
  
  if (tools.length > 0) {
    return callOpenAIWithToolsInternal({ ...params, tools }, startTime);
  }
  
  return callOpenAISimple(params, startTime);
}

async function callOpenAISimple(params: OpenAICallParams, startTime: number): Promise<OpenAICallResult> {
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

async function callOpenAIWithToolsInternal(params: OpenAICallParams, startTime: number): Promise<OpenAICallResult> {
  const maxIterations = params.maxIterations || 5;
  const tools = params.tools!;
  
  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }
  }));

  const toolHandlers = new Map<string, (args: any) => Promise<string>>();
  for (const tool of tools) {
    toolHandlers.set(tool.name, tool.handler);
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  
  if (params.promptSystem) {
    messages.push({ role: "system", content: params.promptSystem });
  }
  messages.push({ role: "user", content: params.promptUser });

  let tokensPrompt = 0;
  let tokensCompletion = 0;
  let totalTokens = 0;
  let iterations = 0;
  let toolResult: any = null;
  let finalResponseContent: string | null = null;
  const apiResponses: any[] = [];

  try {
    const openai = getOpenAIClient();

    while (iterations < maxIterations) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: params.modelName,
        messages,
        tools: openaiTools,
        tool_choice: "auto",
        max_tokens: params.maxTokens || 2048
      });

      apiResponses.push(response);
      
      const usage = response.usage;
      tokensPrompt += usage?.prompt_tokens || 0;
      tokensCompletion += usage?.completion_tokens || 0;
      totalTokens += usage?.total_tokens || 0;

      const choice = response.choices[0];

      if (choice.finish_reason === "stop" || !choice.message.tool_calls) {
        finalResponseContent = choice.message.content || null;
        break;
      }

      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;

        const handler = toolHandlers.get(toolCall.function.name);
        if (!handler) {
          console.error(`[OpenAI API] Unknown tool: ${toolCall.function.name}`);
          continue;
        }

        const args = JSON.parse(toolCall.function.arguments);
        const result = await handler(args);

        if (params.finalToolName && toolCall.function.name === params.finalToolName) {
          toolResult = args;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        });
      }

      if (toolResult) {
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    const log = await storage.saveOpenaiApiLog({
      requestType: params.requestType,
      modelName: params.modelName,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      responseRaw: { iterations, apiResponses, toolResult, messageHistory: messages },
      responseContent: toolResult ? JSON.stringify(toolResult) : finalResponseContent,
      tokensPrompt,
      tokensCompletion,
      tokensTotal: totalTokens,
      durationMs,
      success: !!(toolResult || finalResponseContent),
      errorMessage: null,
      contextType: params.contextType || null,
      contextId: params.contextId || null,
    });

    console.log(`[OpenAI API] ${params.requestType} - Model: ${params.modelName}, Tokens: ${totalTokens}, Iterations: ${iterations}, Duration: ${durationMs}ms`);

    return {
      success: !!(toolResult || finalResponseContent),
      logId: log.id,
      responseContent: finalResponseContent,
      tokensPrompt,
      tokensCompletion,
      tokensTotal: totalTokens,
      durationMs,
      toolResult,
      iterations,
    };

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error.message || String(error);

    const log = await storage.saveOpenaiApiLog({
      requestType: params.requestType,
      modelName: params.modelName,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      responseRaw: { iterations, apiResponses, messageHistory: messages },
      responseContent: null,
      tokensPrompt,
      tokensCompletion,
      tokensTotal: totalTokens,
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
      iterations,
    };
  }
}

export async function getOpenaiLogs(limit: number = 100, requestType?: string): Promise<OpenaiApiLog[]> {
  return storage.getOpenaiApiLogs(limit, requestType);
}

export async function getOpenaiLogById(id: number): Promise<OpenaiApiLog | null> {
  return storage.getOpenaiApiLogById(id);
}
