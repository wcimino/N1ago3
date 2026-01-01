import { db } from "../../../../../db.js";
import { eventsStandard } from "../../../../../../shared/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { storage } from "../../../../../storage/index.js";
import { runAgent, buildAgentContextFromEvent } from "../../agentFramework.js";
import type { BuildContextOptions } from "../../agentTypes.js";
import type { EventStandard } from "../../../../../../shared/schema.js";

const CONFIG_KEY = "response";

export interface ResponseFormatterResult {
  success: boolean;
  formattedMessage: string;
  wasFormatted: boolean;
  logId?: number;
  error?: string;
}

export interface ResponseFormatterRequest {
  conversationId: number;
  externalConversationId?: string;
  suggestedResponse: string;
  event?: EventStandard;
}

async function getLatestCustomerEvent(conversationId: number): Promise<EventStandard | null> {
  const [event] = await db.select()
    .from(eventsStandard)
    .where(and(
      eq(eventsStandard.conversationId, conversationId),
      eq(eventsStandard.eventType, "message"),
      eq(eventsStandard.authorType, "customer")
    ))
    .orderBy(desc(eventsStandard.id))
    .limit(1);
  
  return event || null;
}

async function isFormattingEnabled(): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
  return config?.enabled ?? false;
}

export class ResponseFormatterAgent {
  static async process(request: ResponseFormatterRequest): Promise<ResponseFormatterResult> {
    const { conversationId, externalConversationId, suggestedResponse, event: providedEvent } = request;

    const enabled = await isFormattingEnabled();
    
    if (!enabled) {
      console.log(`[ResponseFormatterAgent] Formatting disabled, returning original message`);
      return {
        success: true,
        formattedMessage: suggestedResponse,
        wasFormatted: false,
      };
    }

    try {
      const event = providedEvent || await getLatestCustomerEvent(conversationId);
      
      if (!event) {
        console.log(`[ResponseFormatterAgent] No event found for conversation ${conversationId}, returning original message`);
        return {
          success: true,
          formattedMessage: suggestedResponse,
          wasFormatted: false,
        };
      }

      console.log(`[ResponseFormatterAgent] Formatting message for conversation ${conversationId}`);

      const contextOptions: BuildContextOptions = {
        includeSummary: true,
        includeClassification: true,
      };

      const agentContext = await buildAgentContextFromEvent(event, contextOptions);
      
      agentContext.sugestaoResposta = suggestedResponse;

      const result = await runAgent(CONFIG_KEY, agentContext);

      if (!result.success || !result.responseContent) {
        console.error(`[ResponseFormatterAgent] Failed to format message for conversation ${conversationId}: ${result.error}`);
        return {
          success: true,
          formattedMessage: suggestedResponse,
          wasFormatted: false,
          logId: result.logId,
          error: result.error,
        };
      }

      const formattedMessage = result.responseContent.trim();
      
      console.log(`[ResponseFormatterAgent] Message formatted successfully for conversation ${conversationId}, logId: ${result.logId}`);
      
      return {
        success: true,
        formattedMessage,
        wasFormatted: true,
        logId: result.logId,
      };
    } catch (error: any) {
      console.error(`[ResponseFormatterAgent] Error formatting message for conversation ${conversationId}:`, error);
      return {
        success: true,
        formattedMessage: suggestedResponse,
        wasFormatted: false,
        error: error.message,
      };
    }
  }
}
