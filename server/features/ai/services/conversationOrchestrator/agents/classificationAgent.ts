import { configStorage } from "../../../../ai/storage/configStorage.js";
import { classificationStorage } from "../../../../ai/storage/classificationStorage.js";
import { runAgent, buildAgentContextFromEvent } from "../../agentFramework.js";
import { productCatalogStorage } from "../../../../products/storage/productCatalogStorage.js";
import type { ClassificationAgentResult, OrchestratorContext } from "../../../../conversation-orchestration/shared/types.js";

const CONFIG_KEY = "classification";

interface ParsedClassification {
  product: string | null;
  subproduct: string | null;
  productConfidence: number | null;
  productConfidenceReason: string | null;
  customerRequestType: string | null;
  customerRequestTypeConfidence: number | null;
  customerRequestTypeReason: string | null;
}

export class ClassificationAgent {
  static async process(context: OrchestratorContext): Promise<ClassificationAgentResult> {
    const { event, conversationId } = context;

    try {
      const shouldClassify = await this.shouldClassify(event);
      
      if (!shouldClassify) {
        console.log(`[ClassificationAgent] Skipping classification for conversation ${conversationId}`);
        return { success: true };
      }

      const agentContext = await buildAgentContextFromEvent(event, {
        includeSummary: true,
        includeClassification: false,
      });

      console.log(`[ClassificationAgent] Classifying conversation ${conversationId} with ${agentContext.messages?.length || 0} messages${agentContext.summary ? ' and existing summary' : ''}`);

      const result = await runAgent(CONFIG_KEY, agentContext, {
        maxIterations: 5,
      });

      if (!result.success) {
        console.error(`[ClassificationAgent] Failed to classify conversation ${conversationId}: ${result.error}`);
        return {
          success: false,
          error: result.error || "Failed to classify",
        };
      }

      if (!result.responseContent) {
        console.log(`[ClassificationAgent] Empty response for conversation ${conversationId}`);
        return { success: true };
      }

      const parsed = this.parseClassificationResult(result.responseContent);

      if (!parsed) {
        const preview = result.responseContent.length > 200 
          ? result.responseContent.substring(0, 200) + '...' 
          : result.responseContent;
        console.error(`[ClassificationAgent] Failed to parse classification response for conversation ${conversationId}. Response preview: ${preview}`);
        return { success: true };
      }

      let productId: number | undefined;
      let productName = "N/A";

      if (parsed.product) {
        const resolvedProduct = await productCatalogStorage.resolveProductId(parsed.product, parsed.subproduct || undefined);
        productId = resolvedProduct?.id;
        productName = resolvedProduct 
          ? `${resolvedProduct.produto}/${resolvedProduct.subproduto || 'N/A'}` 
          : `${parsed.product}/${parsed.subproduct || 'N/A'} (not found in catalog)`;
      }

      await classificationStorage.updateConversationClassification(conversationId, {
        productId: productId || null,
        productConfidence: parsed.productConfidence,
        productConfidenceReason: parsed.productConfidenceReason,
        customerRequestType: parsed.customerRequestType,
        customerRequestTypeConfidence: parsed.customerRequestTypeConfidence,
        customerRequestTypeReason: parsed.customerRequestTypeReason,
      });

      console.log(`[ClassificationAgent] Classification saved for conversation ${conversationId}: ${productName} (${parsed.productConfidence || 0}%), requestType: ${parsed.customerRequestType} (${parsed.customerRequestTypeConfidence || 0}%), logId: ${result.logId}`);

      return {
        success: true,
        productId,
        customerRequestType: parsed.customerRequestType || undefined,
        productConfidence: parsed.productConfidence || undefined,
        customerRequestTypeConfidence: parsed.customerRequestTypeConfidence || undefined,
      };
    } catch (error: any) {
      console.error(`[ClassificationAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to classify",
      };
    }
  }

  private static async shouldClassify(event: OrchestratorContext["event"]): Promise<boolean> {
    const config = await configStorage.getOpenaiApiConfig(CONFIG_KEY);
    
    if (!config || !config.enabled) {
      return false;
    }

    if (!event.conversationId) {
      return false;
    }

    const triggerEventTypes = config.triggerEventTypes || [];
    const triggerAuthorTypes = config.triggerAuthorTypes || [];
    
    let eventTypeMatches = true;
    if (triggerEventTypes.length > 0) {
      const eventKey = `${event.source}:${event.eventType}`;
      const eventTypeOnly = event.eventType;
      eventTypeMatches = triggerEventTypes.includes(eventKey) || triggerEventTypes.includes(eventTypeOnly);
    }
    
    if (!eventTypeMatches) {
      return false;
    }

    if (triggerAuthorTypes.length === 0) {
      return true;
    }

    return triggerAuthorTypes.includes(event.authorType);
  }

  private static parseClassificationResult(responseContent: string): ParsedClassification | null {
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const productConfidenceValue = typeof parsed.productConfidence === 'number' 
        ? Math.round(Math.min(100, Math.max(0, parsed.productConfidence))) 
        : null;

      const customerRequestTypeConfidenceValue = typeof parsed.customerRequestTypeConfidence === 'number' 
        ? Math.round(Math.min(100, Math.max(0, parsed.customerRequestTypeConfidence))) 
        : null;
      
      return {
        product: parsed.product || null,
        subproduct: parsed.subproduct || null,
        productConfidence: productConfidenceValue,
        productConfidenceReason: parsed.productConfidenceReason || null,
        customerRequestType: parsed.customerRequestType || null,
        customerRequestTypeConfidence: customerRequestTypeConfidenceValue,
        customerRequestTypeReason: parsed.customerRequestTypeReason || null,
      };
    } catch {
      return null;
    }
  }
}
