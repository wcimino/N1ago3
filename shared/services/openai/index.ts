export { chat, chatWithTools, embedding, getCurrentProvider } from "./aiService.js";
export { getOpenAIClient } from "./openaiService.js";
export { getReplitAiClient } from "./replitAiService.js";
export { logOpenAIRequest } from "./openaiLogger.js";
export type {
  ChatParams,
  ChatWithToolsParams,
  ChatResult,
  EmbeddingParams,
  EmbeddingResult,
  ToolDefinition,
  OpenAILogData,
} from "./types.js";
export type { AIProvider } from "./aiService.js";
