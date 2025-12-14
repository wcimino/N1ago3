import { shouldGenerateSummary, generateConversationSummary } from "../../summaryOrchestrator.js";
import { storage } from "../../../../../storage/index.js";
import type { SummaryAgentResult, OrchestratorContext } from "../types.js";

export class SummaryAgent {
  static async process(context: OrchestratorContext): Promise<SummaryAgentResult> {
    const { event, conversationId } = context;

    try {
      const shouldGenerate = await shouldGenerateSummary(event);
      
      if (!shouldGenerate) {
        console.log(`[SummaryAgent] Skipping summary generation for conversation ${conversationId}`);
        return { success: true, summary: undefined };
      }

      console.log(`[SummaryAgent] Generating summary for conversation ${conversationId}`);

      await generateConversationSummary(event);

      const savedSummary = await storage.getConversationSummary(conversationId);

      console.log(`[SummaryAgent] Summary generated for conversation ${conversationId}`);

      return {
        success: true,
        summary: savedSummary?.summary || undefined,
        structured: savedSummary ? {
          clientRequest: savedSummary.clientRequest || undefined,
          agentActions: savedSummary.agentActions || undefined,
          currentStatus: savedSummary.currentStatus || undefined,
          importantInfo: savedSummary.importantInfo || undefined,
          customerEmotionLevel: savedSummary.customerEmotionLevel || undefined,
          customerRequestType: savedSummary.customerRequestType || undefined,
        } : undefined,
        lastEventId: event.id,
        externalConversationId: event.externalConversationId,
      };
    } catch (error: any) {
      console.error(`[SummaryAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate summary",
      };
    }
  }
}
