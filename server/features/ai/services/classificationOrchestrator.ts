import { storage } from "../../../storage/index.js";
import { runAgent, type AgentContext } from "./agentFramework.js";
import type { EventStandard } from "../../../../shared/schema.js";
import type { ContentPayload } from "./promptUtils.js";

export interface ClassificationResult {
  product: string | null;
  subproduct: string | null;
  productConfidence: number | null;
  productConfidenceReason: string | null;
  customerRequestType: string | null;
  customerRequestTypeConfidence: number | null;
  customerRequestTypeReason: string | null;
  success: boolean;
  logId: number;
  error?: string;
}

function parseClassificationResult(responseContent: string): ClassificationResult | null {
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
      success: true,
      logId: 0,
    };
  } catch {
    return null;
  }
}

export async function shouldClassify(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("classification");
  
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

export async function classifyConversationProduct(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Classification Orchestrator] Cannot classify: no conversationId");
    return;
  }

  try {
    const [last20Messages, existingSummary] = await Promise.all([
      storage.getLast20MessagesForConversation(event.conversationId),
      storage.getConversationSummary(event.conversationId),
    ]);

    const reversedMessages = [...last20Messages].reverse();

    const context: AgentContext = {
      conversationId: event.conversationId,
      externalConversationId: event.externalConversationId,
      lastEventId: event.id,
      summary: existingSummary?.summary || null,
      messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
        eventSubtype: m.eventSubtype,
        contentPayload: m.contentPayload as ContentPayload | null,
      })),
    };

    console.log(`[Classification Orchestrator] Classifying conversation ${event.conversationId} with ${reversedMessages.length} messages${existingSummary ? ' and existing summary' : ''}`);

    const result = await runAgent("classification", context, {
      maxIterations: 5,
    });

    if (!result.success) {
      console.error(`[Classification Orchestrator] Failed to classify conversation ${event.conversationId}: ${result.error}`);
      return;
    }

    if (!result.responseContent) {
      console.error(`[Classification Orchestrator] Empty response for conversation ${event.conversationId}`);
      return;
    }

    const parsed = parseClassificationResult(result.responseContent);

    if (!parsed) {
      console.error(`[Classification Orchestrator] Failed to parse classification response for conversation ${event.conversationId}`);
      return;
    }

    if (parsed.product) {
      await storage.updateConversationClassification(event.conversationId, {
        product: parsed.product,
        subproduct: parsed.subproduct,
        productConfidence: parsed.productConfidence,
        productConfidenceReason: parsed.productConfidenceReason,
        customerRequestType: parsed.customerRequestType,
        customerRequestTypeConfidence: parsed.customerRequestTypeConfidence,
        customerRequestTypeReason: parsed.customerRequestTypeReason,
      });

      console.log(`[Classification Orchestrator] Classification saved for conversation ${event.conversationId}: ${parsed.product}/${parsed.subproduct} (${parsed.productConfidence}%), requestType: ${parsed.customerRequestType} (${parsed.customerRequestTypeConfidence}%), logId: ${result.logId}`);
    }
  } catch (error: any) {
    console.error(`[Classification Orchestrator] Error in classifyConversationProduct for conversation ${event.conversationId}:`, error);
  }
}

export async function generateAndSaveProductClassification(event: EventStandard): Promise<void> {
  const shouldRun = await shouldClassify(event);
  
  if (shouldRun) {
    await classifyConversationProduct(event);
  }
}
