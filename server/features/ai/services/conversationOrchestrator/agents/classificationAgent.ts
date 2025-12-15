import { generateAndSaveProductClassification } from "../../classificationOrchestrator.js";
import { storage } from "../../../../../storage/index.js";
import type { ClassificationAgentResult, OrchestratorContext } from "../types.js";

export class ClassificationAgent {
  static async process(context: OrchestratorContext): Promise<ClassificationAgentResult> {
    const { event, conversationId } = context;

    try {
      await generateAndSaveProductClassification(event);
      
      const summaryRecord = await storage.getConversationSummary(conversationId);
      
      return {
        success: true,
        productId: summaryRecord?.productId || undefined,
        customerRequestType: summaryRecord?.customerRequestType || undefined,
        productConfidence: summaryRecord?.productConfidence || undefined,
        customerRequestTypeConfidence: summaryRecord?.customerRequestTypeConfidence || undefined,
      };
    } catch (error: any) {
      console.error(`[ClassificationAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to classify",
      };
    }
  }
}
