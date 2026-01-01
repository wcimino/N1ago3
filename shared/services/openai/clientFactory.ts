import OpenAI from "openai";

export type AIProvider = "replit-ai" | "openai";

export interface ClientConfig {
  provider: AIProvider;
  modelPrefix: string;
}

let openaiClient: OpenAI | null = null;
let replitAiClient: OpenAI | null = null;

export function getProvider(): AIProvider {
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

export function getClientConfig(provider: AIProvider): ClientConfig {
  return {
    provider,
    modelPrefix: provider === "replit-ai" ? "replit-ai:" : "",
  };
}

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured. Please add your OpenAI API key.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export function getReplitAiClient(): OpenAI {
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

export function getClient(provider?: AIProvider): OpenAI {
  const resolvedProvider = provider ?? getProvider();
  if (resolvedProvider === "replit-ai") {
    return getReplitAiClient();
  }
  return getOpenAIClient();
}
