import { db } from "../../../server/db.js";
import { openaiApiLogs } from "../../schema.js";
import type { OpenAILogData } from "./types.js";

export async function logOpenAIRequest(data: OpenAILogData): Promise<{ id: number }> {
  const [log] = await db
    .insert(openaiApiLogs)
    .values({
      requestType: data.requestType,
      modelName: data.modelName,
      promptSystem: data.promptSystem,
      promptUser: data.promptUser,
      responseRaw: data.responseRaw,
      responseContent: data.responseContent,
      tokensPrompt: data.tokensPrompt,
      tokensCompletion: data.tokensCompletion,
      tokensTotal: data.tokensTotal,
      durationMs: data.durationMs,
      success: data.success,
      errorMessage: data.errorMessage,
      contextType: data.contextType,
      contextId: data.contextId,
    })
    .returning({ id: openaiApiLogs.id });

  return log;
}

export function logConsole(
  requestType: string,
  model: string,
  tokens: number,
  durationMs: number,
  success: boolean,
  error?: string
): void {
  if (success) {
    console.log(
      `[OpenAI] ${requestType} - Model: ${model}, Tokens: ${tokens}, Duration: ${durationMs}ms`
    );
  } else {
    console.error(
      `[OpenAI] ${requestType} FAILED - Error: ${error}, Duration: ${durationMs}ms`
    );
  }
}
