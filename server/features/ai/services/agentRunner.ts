import { storage } from "../../../storage/index.js";
import { callOpenAI } from "./openaiApiService.js";
import { replacePromptVariables } from "./promptUtils.js";
import { buildPromptVariables } from "./agentContextBuilder.js";
import type { 
  AgentContext, 
  AgentRunnerResult, 
  AgentRunOptions, 
  AgentSuggestionOptions,
  SaveSuggestionOptions 
} from "./agentTypes.js";

export async function runAgent(
  configType: string,
  context: AgentContext,
  options?: AgentRunOptions
): Promise<AgentRunnerResult> {
  const config = await storage.getOpenaiApiConfig(configType);
  
  if (!config) {
    console.log(`[AgentFramework] No config found for ${configType}`);
    return {
      success: false,
      responseContent: null,
      parsedContent: {},
      logId: 0,
      error: `Configuration for '${configType}' not found`,
    };
  }

  if (options?.skipIfDisabled && !config.enabled) {
    console.log(`[AgentFramework] Agent ${configType} is disabled`);
    return {
      success: true,
      responseContent: null,
      parsedContent: {},
      logId: 0,
    };
  }

  let effectivePromptSystem = config.promptSystem || "";

  const variables = await buildPromptVariables(context);

  const systemPromptWithVars = replacePromptVariables(effectivePromptSystem, variables);

  const promptTemplate = config.promptTemplate || "";
  const userPrompt = replacePromptVariables(promptTemplate, variables);

  let fullUserPrompt = userPrompt;
  if (config.responseFormat) {
    fullUserPrompt += `\n\n## Formato da Resposta\n${config.responseFormat}`;
  }

  console.log(`[AgentFramework] Running ${configType} for conversation ${context.conversationId}`);

  const response = await callOpenAI({
    requestType: configType,
    modelName: config.modelName || options?.defaultModelName || "gpt-4o-mini",
    promptSystem: systemPromptWithVars,
    promptUser: fullUserPrompt,
    contextType: "conversation",
    contextId: context.externalConversationId || String(context.conversationId),
    maxIterations: options?.maxIterations,
    finalToolName: options?.finalToolName,
  });

  if (!response.success) {
    return {
      success: false,
      responseContent: null,
      parsedContent: {},
      logId: response.logId,
      error: response.error || "Failed to call OpenAI",
    };
  }

  let parsedContent: any = {};
  if (response.responseContent) {
    try {
      parsedContent = JSON.parse(response.responseContent);
    } catch {
      parsedContent = { rawResponse: response.responseContent };
    }
  }

  return {
    success: true,
    responseContent: response.responseContent,
    parsedContent,
    logId: response.logId,
    toolResult: response.toolResult,
  };
}

export async function saveSuggestedResponse(
  conversationId: number,
  suggestedResponse: string,
  options: SaveSuggestionOptions
): Promise<{ id: number } | null> {
  try {
    const savedSuggestion = await storage.saveSuggestedResponse(conversationId, {
      suggestedResponse,
      lastEventId: options.lastEventId ?? 0,
      openaiLogId: options.openaiLogId ?? 0,
      externalConversationId: options.externalConversationId ?? null,
      inResponseTo: options.inResponseTo ?? null,
      articlesUsed: options.articlesUsed,
    });

    console.log(`[AgentFramework] Saved suggested response for conversation ${conversationId}, id: ${savedSuggestion.id}`);

    return { id: savedSuggestion.id };
  } catch (error: any) {
    console.error(`[AgentFramework] Failed to save suggested response:`, error);
    return null;
  }
}

export async function runAgentAndSaveSuggestion(
  configType: string,
  context: AgentContext,
  options?: AgentSuggestionOptions
): Promise<AgentRunnerResult & { suggestionId?: number }> {
  const result = await runAgent(configType, context, options);

  if (!result.success) {
    return result;
  }

  const suggestionField = options?.suggestionField || "suggestedAnswerToCustomer";
  const suggestedResponse = result.parsedContent?.[suggestionField];

  if (suggestedResponse && typeof suggestedResponse === "string" && suggestedResponse.trim()) {
    const saved = await saveSuggestedResponse(context.conversationId, suggestedResponse, {
      externalConversationId: context.externalConversationId,
      lastEventId: context.lastEventId,
      openaiLogId: result.logId,
      inResponseTo: options?.inResponseTo,
    });

    return {
      ...result,
      suggestionId: saved?.id,
    };
  }

  return result;
}
