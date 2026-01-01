import { logOpenAIRequest, logConsole } from "./openaiLogger.js";
import { getOpenAIClient } from "./clientFactory.js";
import type { EmbeddingParams, EmbeddingResult } from "./types.js";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function truncateForEmbedding(text: string, maxChars: number = 30000): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars);
}

export async function embedding(params: EmbeddingParams): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const model = params.model || DEFAULT_EMBEDDING_MODEL;

  const cleanText = truncateForEmbedding(params.input.trim());

  if (!cleanText) {
    return {
      success: false,
      logId: 0,
      embedding: null,
      tokensTotal: null,
      durationMs: 0,
      error: "Cannot generate embedding for empty text",
    };
  }

  try {
    const client = getOpenAIClient();

    const response = await client.embeddings.create({
      model,
      input: cleanText,
    });

    const durationMs = Date.now() - startTime;
    const embeddingVector = response.data[0].embedding;
    const usage = response.usage;

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: model,
      promptSystem: null,
      promptUser: cleanText.substring(0, 500) + (cleanText.length > 500 ? "..." : ""),
      responseRaw: { model: response.model, usage: response.usage },
      responseContent: `[${embeddingVector.length} dimensions]`,
      tokensPrompt: usage?.prompt_tokens || null,
      tokensCompletion: null,
      tokensTotal: usage?.total_tokens || null,
      durationMs,
      success: true,
      errorMessage: null,
      contextType: params.contextType || null,
      contextId: params.contextId || null,
      correlationId: params.correlationId || null,
    });

    logConsole(params.requestType, model, usage?.total_tokens || 0, durationMs, true);

    return {
      success: true,
      logId: log.id,
      embedding: embeddingVector,
      tokensTotal: usage?.total_tokens || null,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error.message || String(error);

    const log = await logOpenAIRequest({
      requestType: params.requestType,
      modelName: model,
      promptSystem: null,
      promptUser: cleanText.substring(0, 500) + (cleanText.length > 500 ? "..." : ""),
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

    logConsole(params.requestType, model, 0, durationMs, false, errorMessage);

    return {
      success: false,
      logId: log.id,
      embedding: null,
      tokensTotal: null,
      durationMs,
      error: errorMessage,
    };
  }
}
