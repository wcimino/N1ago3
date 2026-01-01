import { chat as unifiedChat, chatWithTools as unifiedChatWithTools } from "./chatService.js";
import { embedding as openaiEmbedding } from "./embeddingService.js";
import { getProvider as getProviderFn, getOpenAIClient, getReplitAiClient } from "./clientFactory.js";
import type {
  ChatParams,
  ChatWithToolsParams,
  ChatResult,
  EmbeddingParams,
  EmbeddingResult,
} from "./types.js";

export type { AIProvider } from "./clientFactory.js";

export function getCurrentProvider() {
  return getProviderFn();
}

export async function chat(params: ChatParams): Promise<ChatResult> {
  const provider = getProviderFn();
  console.log(`[AIService] Using provider: ${provider} for chat request`);
  return unifiedChat(params);
}

export async function chatWithTools(params: ChatWithToolsParams): Promise<ChatResult> {
  const provider = getProviderFn();
  console.log(`[AIService] Using provider: ${provider} for chatWithTools request`);
  return unifiedChatWithTools(params);
}

export async function embedding(params: EmbeddingParams): Promise<EmbeddingResult> {
  return openaiEmbedding(params);
}

export { getOpenAIClient, getReplitAiClient };
