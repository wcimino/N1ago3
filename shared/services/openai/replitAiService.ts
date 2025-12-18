import OpenAI from "openai";
import { logOpenAIRequest, logConsole } from "./openaiLogger.js";
import type {
  ChatParams,
  ChatWithToolsParams,
  ChatResult,
  ToolDefinition,
} from "./types.js";

const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

let replitAiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!replitAiClient) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    
    if (!baseURL || !apiKey) {
      throw new Error(
        "Replit AI Integrations not configured. Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY."
      );
    }
    
    replitAiClient = new OpenAI({ 
      apiKey,
      baseURL,
    });
  }
  return replitAiClient;
}

export async function chat(params: ChatParams): Promise<ChatResult> {
  const startTime = Date.now();
  const model = params.model || DEFAULT_CHAT_MODEL;

  try {
    const client = getClient();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (params.promptSystem) {
      messages.push({ role: "system", content: params.promptSystem });
    }
    messages.push({ role: "user", content: params.promptUser });

    const response = await client.chat.completions.create({
      model,
      messages,
      max_completion_tokens: params.maxTokens || 1024,
    });

    const durationMs = Date.now() - startTime;
    const responseContent = response.choices[0]?.message?.content || null;
    const usage = response.usage;

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: `replit-ai:${model}`,
      promptSystem: params.promptSystem,
      promptUser: params.promptUser,
      responseRaw: response,
      responseContent,
      tokensPrompt: usage?.prompt_tokens || null,
      tokensCompletion: usage?.completion_tokens || null,
      tokensTotal: usage?.total_tokens || null,
      durationMs,
      success: true,
      errorMessage: null,
      contextType: params.contextType || null,
      contextId: params.contextId || null,
      correlationId: params.correlationId || null,
    });

    logConsole(`[ReplitAI] ${params.requestType}`, model, usage?.total_tokens || 0, durationMs, true);

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

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: `replit-ai:${model}`,
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
      correlationId: params.correlationId || null,
    });

    logConsole(`[ReplitAI] ${params.requestType}`, model, 0, durationMs, false, errorMessage);

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

export async function chatWithTools(params: ChatWithToolsParams): Promise<ChatResult> {
  const startTime = Date.now();
  const model = params.model || DEFAULT_CHAT_MODEL;
  const maxIterations = params.maxIterations || 5;

  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = params.tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const toolHandlers = new Map<string, (args: any) => Promise<string>>();
  for (const tool of params.tools) {
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
    const client = getClient();

    while (iterations < maxIterations) {
      iterations++;

      const response = await client.chat.completions.create({
        model,
        messages,
        tools: openaiTools,
        tool_choice: "auto",
        max_tokens: params.maxTokens || 2048,
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
          console.error(`[ReplitAI] Unknown tool: ${toolCall.function.name}`);
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
          content: result,
        });
      }

      if (toolResult) {
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: `replit-ai:${model}`,
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
      correlationId: params.correlationId || null,
    });

    logConsole(`[ReplitAI] ${params.requestType}`, model, totalTokens, durationMs, true);

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

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: `replit-ai:${model}`,
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
      correlationId: params.correlationId || null,
    });

    logConsole(`[ReplitAI] ${params.requestType}`, model, totalTokens, durationMs, false, errorMessage);

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

export { getClient as getReplitAiClient };
