import { conversationStorage } from "../../conversations/storage/conversationStorage.js";
import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import type { OrchestratorContext, OrchestratorStatus, ConversationOwner } from "./types.js";

export interface HandoffTransition {
  status: OrchestratorStatus;
  owner: ConversationOwner | null;
  waitingForCustomer: boolean;
}

export interface HandoffContextPatch {
  articleUuid?: string;
  problemId?: string;
  rootCauseUuid?: string;
  demandFound?: boolean;
  caseSolutionId?: number;
  lastDispatchLog?: OrchestratorContext["lastDispatchLog"];
}

export async function handoffAndReturn<T>(
  context: OrchestratorContext,
  transition: HandoffTransition,
  contextPatch: HandoffContextPatch,
  result: T
): Promise<T> {
  const { conversationId } = context;

  if (contextPatch.articleUuid !== undefined) context.articleUuid = contextPatch.articleUuid;
  if (contextPatch.problemId !== undefined) context.problemId = contextPatch.problemId;
  if (contextPatch.rootCauseUuid !== undefined) context.rootCauseUuid = contextPatch.rootCauseUuid;
  if (contextPatch.demandFound !== undefined) context.demandFound = contextPatch.demandFound;
  if (contextPatch.caseSolutionId !== undefined) context.caseSolutionId = contextPatch.caseSolutionId;
  if (contextPatch.lastDispatchLog !== undefined) context.lastDispatchLog = contextPatch.lastDispatchLog;

  await conversationStorage.updateOrchestratorState(conversationId, {
    orchestratorStatus: transition.status,
    conversationOwner: transition.owner,
    waitingForCustomer: transition.waitingForCustomer,
  });

  context.currentStatus = transition.status;

  return result;
}

export async function isN1agoHandler(conversationId: number): Promise<boolean> {
  const conversation = await conversationStorage.getById(conversationId);
  if (!conversation) {
    return false;
  }
  
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  return conversation.currentHandler === n1agoIntegrationId || 
    conversation.currentHandlerName?.startsWith("n1ago") || false;
}
