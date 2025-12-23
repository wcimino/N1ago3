import { storage } from "../../../../../storage/index.js";
import { SummaryAgent } from "../agents/summaryAgent.js";
import { ClassificationAgent } from "../agents/classificationAgent.js";
import type { OrchestratorContext } from "../types.js";

export interface EnrichmentResult {
  success: boolean;
  summary?: string;
  classification?: {
    productId?: number;
    customerRequestType?: string;
    productConfidence?: number;
    customerRequestTypeConfidence?: number;
  };
  error?: string;
}

export class EnrichmentService {
  static async enrich(context: OrchestratorContext): Promise<EnrichmentResult> {
    const { conversationId } = context;

    try {
      console.log(`[EnrichmentService] Starting enrichment for conversation ${conversationId}`);

      const summaryResult = await SummaryAgent.process(context);
      
      if (summaryResult.success && summaryResult.summary) {
        context.summary = summaryResult.summary;
        console.log(`[EnrichmentService] Summary generated`);
      } else {
        const existingSummary = await storage.getConversationSummary(conversationId);
        if (existingSummary) {
          context.summary = existingSummary.summary;
          console.log(`[EnrichmentService] Using existing summary`);
        }
      }

      const classificationResult = await ClassificationAgent.process(context);
      
      if (classificationResult.success && classificationResult.productId) {
        context.classification = {
          productId: classificationResult.productId,
          customerRequestType: classificationResult.customerRequestType,
          productConfidence: classificationResult.productConfidence,
          customerRequestTypeConfidence: classificationResult.customerRequestTypeConfidence,
        };
        console.log(`[EnrichmentService] Classification from agent - productId: ${context.classification.productId}, confidence: ${context.classification.productConfidence}%`);
      }

      const currentClassification = context.classification;
      const latestSummary = await storage.getConversationSummary(conversationId);
      
      if (latestSummary) {
        context.classification = {
          productId: latestSummary.productId ?? currentClassification?.productId,
          customerRequestType: latestSummary.customerRequestType ?? currentClassification?.customerRequestType,
          productConfidence: latestSummary.productConfidence !== null && latestSummary.productConfidence !== undefined 
            ? latestSummary.productConfidence 
            : currentClassification?.productConfidence,
          customerRequestTypeConfidence: latestSummary.customerRequestTypeConfidence !== null && latestSummary.customerRequestTypeConfidence !== undefined 
            ? latestSummary.customerRequestTypeConfidence 
            : currentClassification?.customerRequestTypeConfidence,
        };
        console.log(`[EnrichmentService] Final classification - productConfidence: ${context.classification.productConfidence}%, requestTypeConfidence: ${context.classification.customerRequestTypeConfidence}%`);
      } else if (currentClassification) {
        console.log(`[EnrichmentService] Using in-memory classification - productConfidence: ${currentClassification.productConfidence}%, requestTypeConfidence: ${currentClassification.customerRequestTypeConfidence}%`);
      } else {
        console.log(`[EnrichmentService] No classification available`);
      }

      console.log(`[EnrichmentService] Enrichment completed for conversation ${conversationId}`);

      return {
        success: true,
        summary: context.summary,
        classification: context.classification,
      };
    } catch (error: any) {
      console.error(`[EnrichmentService] Error enriching conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to enrich conversation",
      };
    }
  }
}
