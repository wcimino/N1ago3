import { storage } from "../../../storage/index.js";
import { extractKnowledgeWithAgent, type AgentLearningPayload } from "./knowledgeLearningAgentAdapter.js";
import { learningAttemptsStorage } from "../storage/learningAttemptsStorage.js";
import type { EventStandard, LearningAttemptResult } from "../../../../shared/schema.js";
import type { ContentPayload } from "./promptUtils.js";

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

async function recordAttempt(
  conversationId: number,
  externalConversationId: string | null,
  result: LearningAttemptResult,
  resultReason: string | null,
  suggestionId?: number,
  messageCount?: number,
  openaiLogId?: number
): Promise<void> {
  try {
    await learningAttemptsStorage.create({
      conversationId,
      externalConversationId,
      result,
      resultReason,
      suggestionId: suggestionId || null,
      messageCount: messageCount || null,
      openaiLogId: openaiLogId || null,
    });
  } catch (error: any) {
    console.error(`[Learning Orchestrator] Failed to record attempt:`, error.message);
  }
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
    const messageCount = last20Messages.length;

    if (messageCount < 3) {
      console.log(`[Learning Orchestrator] Skipping conversation ${event.conversationId}: insufficient messages (${messageCount})`);
      await recordAttempt(
        event.conversationId,
        event.externalConversationId,
        "insufficient_messages",
        `Apenas ${messageCount} mensagens (mínimo: 3)`,
        undefined,
        messageCount
      );
      return;
    }

    const reversedMessages = [...last20Messages].reverse();

    const payload: AgentLearningPayload = {
      messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
        eventSubtype: m.eventSubtype,
        contentPayload: m.contentPayload as ContentPayload | null,
      })),
      currentSummary: existingSummary?.summary || null,
      conversationHandler: null,
    };

    console.log(`[Learning Orchestrator] Extracting knowledge from conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await extractKnowledgeWithAgent(
      payload,
      config.modelName,
      config.promptTemplate,
      config.promptSystem,
      config.responseFormat,
      event.conversationId,
      event.externalConversationId,
      config.useKnowledgeBaseTool ?? false,
      config.useProductCatalogTool ?? false,
      config.useZendeskKnowledgeBaseTool ?? false
    );

    if (result.success) {
      if (result.suggestionType === "skip") {
        console.log(`[Learning Orchestrator] Agent decided to skip conversation ${event.conversationId}`);
        await recordAttempt(
          event.conversationId,
          event.externalConversationId,
          "skipped_by_agent",
          "Agente avaliou e decidiu não extrair conhecimento",
          undefined,
          messageCount,
          result.logId
        );
      } else {
        console.log(`[Learning Orchestrator] Knowledge extracted: type=${result.suggestionType}, suggestionId=${result.suggestionId}${result.targetArticleId ? `, targetArticle=${result.targetArticleId}` : ''}`);
        await recordAttempt(
          event.conversationId,
          event.externalConversationId,
          "suggestion_created",
          `Sugestão de ${result.suggestionType} criada`,
          result.suggestionId,
          messageCount,
          result.logId
        );
      }
    } else {
      console.error(`[Learning Orchestrator] Failed to extract knowledge for conversation ${event.conversationId}: ${result.error}`);
      await recordAttempt(
        event.conversationId,
        event.externalConversationId,
        "processing_error",
        result.error || "Erro desconhecido",
        undefined,
        messageCount,
        result.logId
      );
    }
  } catch (error: any) {
    console.error(`[Learning Orchestrator] Error in extractConversationKnowledge for conversation ${event.conversationId}:`, error);
    await recordAttempt(
      event.conversationId,
      event.externalConversationId,
      "processing_error",
      error.message || "Erro na extração",
      undefined,
      undefined
    );
  }
}

export async function processLearningForEvent(event: EventStandard): Promise<void> {
  const shouldRun = await shouldExtractKnowledge(event);
  
  if (shouldRun) {
    await extractConversationKnowledge(event);
  }
}
