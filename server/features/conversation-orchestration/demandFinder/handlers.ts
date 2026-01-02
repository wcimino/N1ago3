import { caseDemandStorage } from "../../ai/storage/caseDemandStorage.js";
import { conversationStorage } from "../../conversations/storage/index.js";
import { 
  ActionExecutor,
  ORCHESTRATOR_STATUS, 
  CONVERSATION_OWNER, 
  type OrchestratorContext, 
  type OrchestratorAction,
  createAgentLogger,
  escalateConversation,
} from "../shared/index.js";

const MAX_INTERACTIONS = 5;
const log = createAgentLogger("DemandFinderOrchestrator");

export interface DemandFinderPromptResult {
  decision: "selected_intent" | "need_clarification";
  selected_intent: {
    id: string | null;
    label: string | null;
  };
  top_candidates_ranked: Array<{ id: string; label: string; why: string }>;
  clarifying_question: string | null;
  selected_intent_confidence?: number;
  reason: string;
  suggestionId?: number;
}

export interface SearchResult {
  source: "article" | "problem";
  id: string;
  name: string;
  description: string;
  matchScore: number;
}

export interface DecisionHandlerResult {
  success: boolean;
  demandConfirmed: boolean;
  needsClarification: boolean;
  maxInteractionsReached: boolean;
  messageSent: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export async function handleSelectedIntent(
  context: OrchestratorContext,
  promptResult: DemandFinderPromptResult,
  searchResults: SearchResult[]
): Promise<DecisionHandlerResult> {
  const { conversationId } = context;
  const selectedIntentId = promptResult.selected_intent.id!;
  const candidateIds = searchResults.map(r => r.id);
  const isValidCandidate = candidateIds.includes(selectedIntentId);

  if (!isValidCandidate) {
    log.warn(conversationId, `AI selected intent "${selectedIntentId}" is NOT in candidate list: ${candidateIds.join(', ')}. Escalating`);
    
    await caseDemandStorage.updateDemandFinderAiResponse(conversationId, {
      decision: promptResult.decision,
      selected_intent: promptResult.selected_intent,
      top_candidates_ranked: promptResult.top_candidates_ranked || [],
      clarifying_question: promptResult.clarifying_question,
      selected_intent_confidence: promptResult.selected_intent_confidence,
      reason: promptResult.reason,
    });
    
    await escalateConversation(conversationId, context, `AI selected invalid intent: "${selectedIntentId}" not in candidates`, {
      sendApologyMessage: true,
      updateCaseDemandStatus: true,
      caseDemandStatus: "demand_not_found",
    });
    
    context.lastDispatchLog = {
      solutionCenterResults: searchResults.length,
      aiDecision: promptResult.decision,
      aiReason: promptResult.reason,
      action: "escalated_invalid_intent_selection",
      details: { 
        selectedIntentId,
        selectedIntentLabel: promptResult.selected_intent.label,
        validCandidateIds: candidateIds,
      },
    };
    
    return {
      success: true,
      demandConfirmed: false,
      needsClarification: false,
      maxInteractionsReached: true,
      messageSent: false,
      suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
      error: `AI selected invalid intent: "${selectedIntentId}" not in candidates`,
    };
  }

  log.action(conversationId, "Demand confirmed", `intent: ${promptResult.selected_intent.id} (${promptResult.selected_intent.label})`);
  
  await caseDemandStorage.updateSelectedIntent(conversationId, selectedIntentId, {
    decision: promptResult.decision,
    selected_intent: promptResult.selected_intent,
    top_candidates_ranked: promptResult.top_candidates_ranked || [],
    clarifying_question: promptResult.clarifying_question,
    selected_intent_confidence: promptResult.selected_intent_confidence,
    reason: promptResult.reason,
  });
  
  await conversationStorage.updateOrchestratorState(conversationId, {
    orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
    conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
    waitingForCustomer: false,
  });
  await caseDemandStorage.updateStatus(conversationId, "demand_found");
  
  context.currentStatus = ORCHESTRATOR_STATUS.PROVIDING_SOLUTION;
  context.demandFound = true;
  
  const selectedResult = searchResults.find(r => r.id === selectedIntentId);
  
  if (selectedResult?.source === "article") {
    context.articleUuid = selectedIntentId;
  } else if (selectedResult?.source === "problem") {
    context.problemId = selectedIntentId;
  }
  
  context.lastDispatchLog = {
    solutionCenterResults: searchResults.length,
    aiDecision: promptResult.decision,
    aiReason: promptResult.reason,
    action: "demand_confirmed_to_solution_provider",
    details: { 
      selectedIntentId,
      selectedIntentLabel: promptResult.selected_intent.label,
      intentType: selectedResult?.source || "unknown",
    },
  };
  
  return {
    success: true,
    demandConfirmed: true,
    needsClarification: false,
    maxInteractionsReached: false,
    messageSent: false,
  };
}

export async function handleNeedClarification(
  context: OrchestratorContext,
  promptResult: DemandFinderPromptResult,
  searchResults: SearchResult[]
): Promise<DecisionHandlerResult> {
  const { conversationId } = context;

  const currentInteractionCount = await caseDemandStorage.getInteractionCount(conversationId);
  log.info(conversationId, `Interaction count: ${currentInteractionCount}/${MAX_INTERACTIONS}`);

  if (currentInteractionCount >= MAX_INTERACTIONS) {
    log.warn(conversationId, "Max interactions already reached, escalating");
    await escalateConversation(conversationId, context, "Max interactions reached", {
      sendApologyMessage: true,
      updateCaseDemandStatus: true,
      caseDemandStatus: "demand_not_found",
    });
    
    context.lastDispatchLog = {
      solutionCenterResults: searchResults.length,
      aiDecision: promptResult.decision,
      aiReason: promptResult.reason,
      action: "escalated_max_interactions",
      details: { interactionCount: currentInteractionCount, maxInteractions: MAX_INTERACTIONS },
    };
    
    return {
      success: true,
      demandConfirmed: false,
      needsClarification: false,
      maxInteractionsReached: true,
      messageSent: false,
      suggestedResponse: "Ok, vou te transferir para um especialista agora",
    };
  }

  const clarifyingQuestion = promptResult.clarifying_question;
  const suggestionId = promptResult.suggestionId;

  await caseDemandStorage.updateDemandFinderAiResponse(conversationId, {
    decision: promptResult.decision,
    selected_intent: promptResult.selected_intent,
    top_candidates_ranked: promptResult.top_candidates_ranked || [],
    clarifying_question: promptResult.clarifying_question,
    selected_intent_confidence: promptResult.selected_intent_confidence,
    reason: promptResult.reason,
  });
  
  if (!clarifyingQuestion || !suggestionId) {
    log.warn(conversationId, "No clarifying question or suggestionId from AI, escalating");
    await escalateConversation(conversationId, context, "No clarifying question generated", {
      sendApologyMessage: false,
      updateCaseDemandStatus: true,
      caseDemandStatus: "demand_not_found",
    });
    return {
      success: true,
      demandConfirmed: false,
      needsClarification: false,
      maxInteractionsReached: true,
      messageSent: false,
      suggestedResponse: "Vou te transferir para um especialista que podera te ajudar melhor.",
    };
  }

  const newInteractionCount = await caseDemandStorage.incrementInteractionCount(conversationId);
  log.info(conversationId, `Incremented interaction count to ${newInteractionCount}/${MAX_INTERACTIONS}`);

  log.action(conversationId, "Sending clarification question");
  const action: OrchestratorAction = {
    type: "SEND_MESSAGE",
    payload: { suggestionId, responsePreview: clarifyingQuestion }
  };
  await ActionExecutor.execute(context, [action]);

  await conversationStorage.updateOrchestratorState(conversationId, {
    orchestratorStatus: ORCHESTRATOR_STATUS.FINDING_DEMAND,
    conversationOwner: CONVERSATION_OWNER.DEMAND_FINDER,
    waitingForCustomer: true,
  });
  context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
  
  context.lastDispatchLog = {
    solutionCenterResults: searchResults.length,
    aiDecision: promptResult.decision,
    aiReason: promptResult.reason,
    action: "sent_clarification",
    details: { interactionCount: newInteractionCount, maxInteractions: MAX_INTERACTIONS, suggestionId },
  };
  
  return {
    success: true,
    demandConfirmed: false,
    needsClarification: true,
    maxInteractionsReached: false,
    messageSent: true,
    suggestedResponse: clarifyingQuestion,
    suggestionId,
  };
}

export function createEscalationResult(error?: string): DecisionHandlerResult {
  return {
    success: true,
    demandConfirmed: false,
    needsClarification: false,
    maxInteractionsReached: true,
    messageSent: false,
    suggestedResponse: "Vou te transferir para um especialista que podera te ajudar.",
    error,
  };
}
