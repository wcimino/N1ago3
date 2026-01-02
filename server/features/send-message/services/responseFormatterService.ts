import { ResponseFormatterAgent } from "../../ai/services/conversationOrchestrator/agents/responseFormatterAgent.js";
import type { EventStandard } from "../../../../shared/schema.js";
import { configStorage } from "../../ai/storage/configStorage.js";

export interface FormatMessageRequest {
  message: string;
  conversationId: number;
  externalConversationId?: string;
  event?: EventStandard;
}

export interface FormatMessageResult {
  success: boolean;
  formattedMessage: string;
  wasFormatted: boolean;
  logId?: number;
  error?: string;
}

export async function formatMessage(request: FormatMessageRequest): Promise<FormatMessageResult> {
  const { message, conversationId, externalConversationId, event } = request;

  const result = await ResponseFormatterAgent.process({
    conversationId,
    externalConversationId,
    suggestedResponse: message,
    event,
  });

  return {
    success: result.success,
    formattedMessage: result.formattedMessage,
    wasFormatted: result.wasFormatted,
    logId: result.logId,
    error: result.error,
  };
}

async function isFormattingEnabled(): Promise<boolean> {
  const config = await configStorage.getOpenaiApiConfig("response");
  return config?.enabled ?? false;
}

export const ResponseFormatterService = {
  formatMessage,
  isFormattingEnabled,
};
