import { db } from "../../../db.js";
import { responsesSuggested } from "../../../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { SendMessageService } from "../../send-message/index.js";

type SuggestionStatus = "created" | "sent" | "expired";

interface AutoPilotResult {
  success: boolean;
  action: "sent" | "expired" | "skipped";
  reason?: string;
}

async function getSuggestionById(suggestionId: number) {
  const [suggestion] = await db.select()
    .from(responsesSuggested)
    .where(eq(responsesSuggested.id, suggestionId));
  return suggestion || null;
}

async function updateSuggestionStatus(suggestionId: number, status: SuggestionStatus, currentStatus?: string): Promise<boolean> {
  const updateData: { status: SuggestionStatus; usedAt?: Date } = { status };
  
  if (status === "sent") {
    updateData.usedAt = new Date();
  }
  
  const result = await db.update(responsesSuggested)
    .set(updateData)
    .where(and(
      eq(responsesSuggested.id, suggestionId),
      currentStatus ? eq(responsesSuggested.status, currentStatus) : undefined
    ));
  
  return (result.rowCount ?? 0) > 0;
}

export async function processSuggestion(suggestionId: number): Promise<AutoPilotResult> {
  console.log(`[AutoPilot] Processing suggestion ${suggestionId}`);
  
  const suggestion = await getSuggestionById(suggestionId);
  
  if (!suggestion) {
    console.error(`[AutoPilot] Suggestion ${suggestionId} not found`);
    return { success: false, action: "skipped", reason: "suggestion_not_found" };
  }
  
  if (suggestion.status !== "created") {
    console.log(`[AutoPilot] Suggestion ${suggestionId} already processed (status: ${suggestion.status})`);
    return { success: true, action: "skipped", reason: `already_${suggestion.status}` };
  }
  
  if (!suggestion.externalConversationId) {
    await updateSuggestionStatus(suggestionId, "expired", "created");
    console.log(`[AutoPilot] Suggestion ${suggestionId} has no externalConversationId, marking as expired`);
    return { success: true, action: "expired", reason: "no_external_conversation_id" };
  }

  if (!suggestion.lastEventId) {
    await updateSuggestionStatus(suggestionId, "expired", "created");
    console.log(`[AutoPilot] Suggestion ${suggestionId} has no lastEventId, marking as expired`);
    return { success: true, action: "expired", reason: "suggestion_has_no_last_event_id" };
  }

  const updated = await updateSuggestionStatus(suggestionId, "sent", "created");
  
  if (!updated) {
    console.log(`[AutoPilot] Suggestion ${suggestionId} was already processed by another process`);
    return { success: true, action: "skipped", reason: "already_processed_by_another_process" };
  }
  
  const sendResult = await SendMessageService.send({
    conversationId: suggestion.conversationId,
    externalConversationId: suggestion.externalConversationId,
    message: suggestion.suggestedResponse,
    type: "response",
    source: "autopilot",
    lastEventId: suggestion.lastEventId,
    inResponseTo: suggestion.inResponseTo || undefined,
  });
  
  if (!sendResult.sent) {
    await updateSuggestionStatus(suggestionId, "expired");
    console.log(`[AutoPilot] Suggestion ${suggestionId} not sent: ${sendResult.reason}, marked as expired`);
    return { success: true, action: "expired", reason: sendResult.reason };
  }
  
  console.log(`[AutoPilot] Suggestion ${suggestionId} sent successfully`);
  
  return { success: true, action: "sent", reason: "message_sent" };
}

export const AutoPilotService = {
  processSuggestion,
};
