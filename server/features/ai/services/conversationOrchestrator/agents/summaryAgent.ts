import { generateConversationSummary, shouldGenerateSummary } from "../../summaryOrchestrator.js";
import { storage } from "../../../../../storage/index.js";
import type { EventStandard } from "../../../../../../shared/schema.js";
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

      await generateConversationSummary(event);
      
      const summaryRecord = await storage.getConversationSummary(conversationId);
      
      return {
        success: true,
        summary: summaryRecord?.summary || undefined,
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
