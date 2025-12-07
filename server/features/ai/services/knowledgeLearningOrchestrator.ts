import { storage } from "../../../storage/index.js";
import { extractKnowledgeWithAgent, type AgentLearningPayload } from "./knowledgeLearningAgentAdapter.js";
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

    if (last20Messages.length < 3) {
      console.log(`[Learning Orchestrator] Skipping conversation ${event.conversationId}: insufficient messages (${last20Messages.length})`);
      return;
    }

    const reversedMessages = [...last20Messages].reverse();

    const payload: AgentLearningPayload = {
      messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
      })),
      currentSummary: existingSummary?.summary || null,
      conversationHandler: null,
    };

    console.log(`[Learning Orchestrator] Extracting knowledge with agent from conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await extractKnowledgeWithAgent(
      payload,
      config.modelName,
      config.promptTemplate,
      event.conversationId,
      event.externalConversationId
    );

    if (result.success) {
      if (result.suggestionType === "skip") {
        console.log(`[Learning Orchestrator] Agent decided to skip conversation ${event.conversationId}`);
      } else {
        console.log(`[Learning Orchestrator] Knowledge extracted: type=${result.suggestionType}, suggestionId=${result.suggestionId}${result.targetArticleId ? `, targetArticle=${result.targetArticleId}` : ''}`);
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
