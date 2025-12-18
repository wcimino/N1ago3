import * as openaiService from "./openaiService.js";
import * as replitAiService from "./replitAiService.js";
import type {
  ChatParams,
  ChatWithToolsParams,
  ChatResult,
  EmbeddingParams,
  EmbeddingResult,
} from "./types.js";

export type AIProvider = "replit-ai" | "openai";

function getProvider(): AIProvider {
  const provider = process.env.AI_CHAT_PROVIDER;
  if (provider === "openai") {
    return "openai";
  }
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return "replit-ai";
  }
  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }
  return "replit-ai";
}

export function getCurrentProvider(): AIProvider {
  return getProvider();
}

export async function chat(params: ChatParams): Promise<ChatResult> {
  const provider = getProvider();
  console.log(`[AIService] Using provider: ${provider} for chat request`);
  
  if (provider === "replit-ai") {
    return replitAiService.chat(params);
  }
  return openaiService.chat(params);
}

export async function chatWithTools(params: ChatWithToolsParams): Promise<ChatResult> {
  const provider = getProvider();
  console.log(`[AIService] Using provider: ${provider} for chatWithTools request`);
  
  if (provider === "replit-ai") {
    return replitAiService.chatWithTools(params);
  }
  return openaiService.chatWithTools(params);
}

export async function embedding(params: EmbeddingParams): Promise<EmbeddingResult> {
  return openaiService.embedding(params);
}

export { openaiService, replitAiService };
