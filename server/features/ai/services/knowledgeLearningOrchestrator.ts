import { storage } from "../../../storage/index.js";
import { extractAndSaveKnowledge, type LearningPayload } from "./knowledgeLearningAdapter.js";
import { knowledgeBaseService } from "./knowledgeBaseService.js";
import type { EventStandard } from "../../../../shared/schema.js";

export async function shouldExtractKnowledge(event: EventStandard): Promise<boolean> {
  const config = await storage.getOpenaiApiConfig("learning");
  
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

export async function extractConversationKnowledge(event: EventStandard): Promise<void> {
  if (!event.conversationId) {
    console.log("[Learning Orchestrator] Cannot extract knowledge: no conversationId");
    return;
  }

  const config = await storage.getOpenaiApiConfig("learning");
  if (!config) {
    console.log("[Learning Orchestrator] Cannot extract knowledge: no config found");
    return;
  }

  try {
    const last20Messages = await storage.getLast20MessagesForConversation(event.conversationId);
    const existingSummary = await storage.getConversationSummary(event.conversationId);
    const classification = await storage.getConversationClassification(event.conversationId);

    if (last20Messages.length < 3) {
      console.log(`[Learning Orchestrator] Skipping conversation ${event.conversationId}: insufficient messages (${last20Messages.length})`);
      return;
    }

    const reversedMessages = [...last20Messages].reverse();

    const descriptionKeywords = existingSummary?.summary
      ?.split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 10) || [];

    const relatedArticles = await knowledgeBaseService.findRelatedArticles(
      classification?.productStandard || undefined,
      classification?.category1 || undefined,
      classification?.category2 || undefined,
      descriptionKeywords,
      { limit: 3, minScore: 30 }
    );

    const articlesContext = knowledgeBaseService.formatArticlesForPrompt(relatedArticles);

    console.log(`[Learning Orchestrator] Found ${relatedArticles.length} related articles for conversation ${event.conversationId}`);

    const payload: LearningPayload = {
      messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
      })),
      currentSummary: existingSummary?.summary || null,
      conversationHandler: null,
      relatedArticles: articlesContext,
    };

    console.log(`[Learning Orchestrator] Extracting knowledge from conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await extractAndSaveKnowledge(
      payload,
      config.promptTemplate,
      config.modelName,
      event.conversationId,
      event.externalConversationId
    );

    if (result.success) {
      console.log(`[Learning Orchestrator] Knowledge extracted for conversation ${event.conversationId}, suggestionId: ${result.suggestionId}`);
      if (result.similarArticleId) {
        console.log(`[Learning Orchestrator] Found similar article ${result.similarArticleId} with score ${result.similarityScore}`);
      }
    } else {
      console.error(`[Learning Orchestrator] Failed to extract knowledge for conversation ${event.conversationId}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[Learning Orchestrator] Error in extractConversationKnowledge for conversation ${event.conversationId}:`, error);
  }
}

export async function processLearningForEvent(event: EventStandard): Promise<void> {
  const shouldRun = await shouldExtractKnowledge(event);
  
  if (shouldRun) {
    await extractConversationKnowledge(event);
  }
}
