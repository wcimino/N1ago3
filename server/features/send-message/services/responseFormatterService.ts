import { storage } from "../../../storage/index.js";
import { callOpenAI } from "../../ai/services/openaiApiService.js";

const CONFIG_KEY = "response";

export interface FormatMessageRequest {
  message: string;
  conversationId: number;
  externalConversationId?: string;
}

export interface FormatMessageResult {
  success: boolean;
  formattedMessage: string;
  wasFormatted: boolean;
  logId?: number;
  error?: string;
}

async function isFormattingEnabled(): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
  return config?.enabled ?? false;
}

async function buildFormattingPrompts(originalMessage: string): Promise<{
  systemPrompt: string;
  userPrompt: string;
  modelName: string;
} | null> {
  const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
  
  if (!config) {
    return null;
  }

  let systemPrompt = config.promptSystem || "";

  const formattingContext = `
Você é um especialista em comunicação com clientes. Sua tarefa é ajustar o tom de voz e formatar a mensagem abaixo para que ela siga as diretrizes de comunicação estabelecidas.

Regras importantes:
1. Mantenha o conteúdo e informações da mensagem original
2. Ajuste apenas o tom de voz, estilo e formatação
3. Não adicione informações que não estavam na mensagem original
4. Não remova informações importantes
5. Retorne APENAS a mensagem formatada, sem explicações adicionais
`;

  systemPrompt = formattingContext + "\n\n" + systemPrompt;

  let userPrompt = "";
  
  if (config.promptTemplate) {
    userPrompt = config.promptTemplate.replace(/\{\{MENSAGEM_ORIGINAL\}\}/g, originalMessage);
    userPrompt = userPrompt.replace(/\{\{ULTIMA_MENSAGEM\}\}/g, originalMessage);
  }
  
  if (!userPrompt || !userPrompt.includes(originalMessage)) {
    userPrompt = `## Mensagem Original:\n${originalMessage}`;
  }

  if (config.responseFormat) {
    userPrompt += `\n\n## Formato da Resposta\n${config.responseFormat}`;
  } else {
    userPrompt += `\n\n## Formato da Resposta\nRetorne apenas a mensagem formatada, sem JSON, sem explicações, apenas o texto da mensagem.`;
  }

  return {
    systemPrompt,
    userPrompt,
    modelName: config.modelName || "gpt-4o-mini",
  };
}

export async function formatMessage(request: FormatMessageRequest): Promise<FormatMessageResult> {
  const { message, conversationId, externalConversationId } = request;

  const enabled = await isFormattingEnabled();
  
  if (!enabled) {
    console.log(`[ResponseFormatterService] Formatting disabled, returning original message`);
    return {
      success: true,
      formattedMessage: message,
      wasFormatted: false,
    };
  }

  try {
    const prompts = await buildFormattingPrompts(message);
    
    if (!prompts) {
      console.log(`[ResponseFormatterService] No config found, returning original message`);
      return {
        success: true,
        formattedMessage: message,
        wasFormatted: false,
      };
    }

    console.log(`[ResponseFormatterService] Formatting message for conversation ${conversationId}`);

    const response = await callOpenAI({
      requestType: "response_formatting",
      modelName: prompts.modelName,
      promptSystem: prompts.systemPrompt,
      promptUser: prompts.userPrompt,
      contextType: "conversation",
      contextId: externalConversationId || String(conversationId),
    });

    if (!response.success || !response.responseContent) {
      console.error(`[ResponseFormatterService] OpenAI call failed: ${response.error}`);
      return {
        success: true,
        formattedMessage: message,
        wasFormatted: false,
        logId: response.logId,
        error: response.error,
      };
    }

    const formattedMessage = response.responseContent.trim();
    
    console.log(`[ResponseFormatterService] Message formatted successfully for conversation ${conversationId}`);
    
    return {
      success: true,
      formattedMessage,
      wasFormatted: true,
      logId: response.logId,
    };
  } catch (error: any) {
    console.error(`[ResponseFormatterService] Error formatting message:`, error);
    return {
      success: true,
      formattedMessage: message,
      wasFormatted: false,
      error: error.message,
    };
  }
}

export const ResponseFormatterService = {
  formatMessage,
  isFormattingEnabled,
};
