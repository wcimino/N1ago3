import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured. Please add your OpenAI API key.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface SummaryPayload {
  currentSummary: string | null;
  last20Messages: Array<{
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  }>;
  lastMessage: {
    authorType: string;
    authorName: string | null;
    contentText: string | null;
    occurredAt: Date;
  };
}

export interface SummaryResult {
  summary: string;
  success: boolean;
  error?: string;
}

export async function generateSummary(
  payload: SummaryPayload,
  promptTemplate: string,
  modelName: string = "gpt-5"
): Promise<SummaryResult> {
  try {
    const messagesContext = payload.last20Messages
      .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
      .join('\n');

    const lastMessageContext = `[${payload.lastMessage.authorType}${payload.lastMessage.authorName ? ` - ${payload.lastMessage.authorName}` : ''}]: ${payload.lastMessage.contentText || '(sem texto)'}`;

    const systemPrompt = promptTemplate
      .replace('{{RESUMO_ATUAL}}', payload.currentSummary || 'Nenhum resumo anterior disponível.')
      .replace('{{ULTIMAS_20_MENSAGENS}}', messagesContext || 'Nenhuma mensagem anterior.')
      .replace('{{ULTIMA_MENSAGEM}}', lastMessageContext);

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em gerar resumos de conversas de atendimento ao cliente. Gere resumos concisos e informativos."
        },
        {
          role: "user",
          content: systemPrompt
        }
      ],
      max_completion_tokens: 1024,
    });

    const summary = response.choices[0]?.message?.content;

    if (!summary) {
      return {
        summary: "",
        success: false,
        error: "OpenAI returned empty response"
      };
    }

    return {
      summary,
      success: true
    };
  } catch (error: any) {
    console.error("Error generating summary with OpenAI:", error);
    return {
      summary: "",
      success: false,
      error: error.message || String(error)
    };
  }
}
