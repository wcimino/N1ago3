import { storage } from "../../../storage/index.js";
import { runAgent } from "./agentFramework.js";
import { learningAttemptsStorage } from "../storage/learningAttemptsStorage.js";
import { knowledgeSuggestionsStorage } from "../storage/knowledgeSuggestionsStorage.js";
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

async function saveSuggestionFromToolResult(
  toolResult: any,
  conversationId: number,
  externalConversationId: string | null,
  handler: string | null
): Promise<{ suggestionId?: number; suggestionType: "create" | "update" | "skip"; targetArticleId?: number } | null> {
  if (!toolResult || !toolResult.action) {
    return null;
  }

  if (toolResult.action === "skip") {
    console.log(`[Learning Orchestrator] Skipping conversation ${conversationId}: ${toolResult.skipReason}`);
    return {
      suggestionType: "skip",
    };
  }

  const suggestion = await knowledgeSuggestionsStorage.createSuggestion({
    conversationId,
    externalConversationId,
    suggestionType: toolResult.action,
    name: toolResult.name,
    productStandard: toolResult.productStandard,
    subproductStandard: toolResult.subproductStandard,
    description: toolResult.description,
    resolution: toolResult.resolution,
    observations: toolResult.observations,
    confidenceScore: toolResult.confidenceScore,
    similarArticleId: toolResult.targetArticleId,
    updateReason: toolResult.updateReason,
    status: "pending",
    conversationHandler: handler,
    rawExtraction: toolResult
  });

  console.log(`[Learning Orchestrator] Suggestion saved: id=${suggestion.id}, type=${toolResult.action}, targetArticle=${toolResult.targetArticleId || 'N/A'}`);

  return {
    suggestionId: suggestion.id,
    suggestionType: toolResult.action,
    targetArticleId: toolResult.targetArticleId,
  };
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

    console.log(`[Learning Orchestrator] Extracting knowledge from conversation ${event.conversationId} with ${reversedMessages.length} messages`);

    const result = await runAgent("learning", {
      conversationId: event.conversationId,
      externalConversationId: event.externalConversationId,
      summary: existingSummary?.summary || null,
      messages: reversedMessages.map(m => ({
        authorType: m.authorType,
        authorName: m.authorName,
        contentText: m.contentText,
        occurredAt: m.occurredAt,
        eventSubtype: m.eventSubtype,
        contentPayload: m.contentPayload as ContentPayload | null,
      })),
    }, {
      maxIterations: 5,
    });

    if (result.success && result.toolResult) {
      const suggestionResult = await saveSuggestionFromToolResult(
        result.toolResult,
        event.conversationId,
        event.externalConversationId,
        null
      );

      if (suggestionResult) {
        if (suggestionResult.suggestionType === "skip") {
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
          console.log(`[Learning Orchestrator] Knowledge extracted: type=${suggestionResult.suggestionType}, suggestionId=${suggestionResult.suggestionId}${suggestionResult.targetArticleId ? `, targetArticle=${suggestionResult.targetArticleId}` : ''}`);
          await recordAttempt(
            event.conversationId,
            event.externalConversationId,
            "suggestion_created",
            `Sugestão de ${suggestionResult.suggestionType} criada`,
            suggestionResult.suggestionId,
            messageCount,
            result.logId
          );
        }
      }
    } else if (!result.success) {
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
    } else {
      console.log(`[Learning Orchestrator] Agent did not produce a suggestion for conversation ${event.conversationId}`);
      await recordAttempt(
        event.conversationId,
        event.externalConversationId,
        "processing_error",
        "Agent did not produce a suggestion",
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
