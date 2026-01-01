import { caseSolutionStorage } from "../../../storage/caseSolutionStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { summaryStorage } from "../../../storage/summaryStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";
import { saveSuggestedResponse } from "../../agentFramework.js";
import { callOpenAI } from "../../openaiApiService.js";
import {
  getActionDescription,
  getActionAgentInstructions,
  resolveMessageFromVariations,
  type CaseAction,
} from "./actionStateMachine.js";
import type { ClientHubData } from "../../../../../../shared/schema/clientHub.js";

interface SolutionProviderAIResponse {
  mensagem?: string;
  motivo?: string;
}

export interface ActionExecutionResult {
  success: boolean;
  solutionFound: boolean;
  caseSolutionId: number;
  actionExecuted?: string;
  escalated: boolean;
  waitingForCustomer?: boolean;
  messageSent?: boolean;
  error?: string;
}

export async function getClientHubData(
  context: OrchestratorContext
): Promise<ClientHubData | null> {
  const { conversationId, event } = context;

  if (event.externalConversationId) {
    const existingSummary = await summaryStorage.getConversationSummaryByExternalId(event.externalConversationId);
    if (existingSummary?.clientHubData) {
      return existingSummary.clientHubData as ClientHubData;
    }
  }

  if (conversationId) {
    const clientHubData = await summaryStorage.getClientHubData(conversationId);
    return clientHubData as ClientHubData | null;
  }

  return null;
}

export async function executeTransferToHuman(
  context: OrchestratorContext,
  caseSolutionId: number,
  action: CaseAction
): Promise<ActionExecutionResult> {
  const { conversationId } = context;

  console.log(`[ActionExecutors] Executing transfer to human`);

  const transferMessage = "Vou te transferir para um especialista que poderá te ajudar melhor.";
  const orchestratorAction: OrchestratorAction = {
    type: "TRANSFER_TO_HUMAN",
    payload: { reason: "Action requires human transfer", message: transferMessage },
  };

  await ActionExecutor.execute(context, [orchestratorAction]);

  await caseSolutionStorage.updateActionStatus(action.id, "completed", {
    output: { transferred: true },
  });
  await caseSolutionStorage.updateStatus(caseSolutionId, "escalated");

  await conversationStorage.updateOrchestratorState(conversationId, {
    orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
    conversationOwner: null,
    waitingForCustomer: false,
  });

  context.lastDispatchLog = {
    solutionCenterResults: 0,
    aiDecision: "transfer_to_human",
    aiReason: "Action type requires human transfer",
    action: "transfer_to_human",
    details: { caseSolutionId, actionId: action.id },
  };

  return {
    success: true,
    solutionFound: true,
    caseSolutionId,
    actionExecuted: "transfer_to_human",
    escalated: true,
    messageSent: true,
  };
}

export async function executeAutomaticAction(
  context: OrchestratorContext,
  caseSolutionId: number,
  action: CaseAction
): Promise<ActionExecutionResult> {
  console.log(`[ActionExecutors] Executing automatic action: consultar_perfil_cliente`);

  const clientHubData = await getClientHubData(context);

  if (clientHubData) {
    await caseSolutionStorage.updateCollectedInputs(caseSolutionId, undefined, {
      clientProfile: clientHubData,
    });
    
    await caseSolutionStorage.updateActionStatus(action.id, "completed", {
      output: { profileFound: true, dataKeys: Object.keys(clientHubData) },
    });
    
    console.log(`[ActionExecutors] Client profile found, action completed`);
  } else {
    await caseSolutionStorage.updateActionStatus(action.id, "completed", {
      output: { profileFound: false, reason: "No client data available" },
    });
    
    console.log(`[ActionExecutors] No client profile, marking as completed anyway`);
  }

  context.lastDispatchLog = {
    solutionCenterResults: 0,
    aiDecision: "automatic_action",
    aiReason: "Consultar perfil executed automatically",
    action: "consultar_perfil_cliente",
    details: { caseSolutionId, actionId: action.id, profileFound: !!clientHubData },
  };

  return {
    success: true,
    solutionFound: true,
    caseSolutionId,
    actionExecuted: "consultar_perfil_cliente",
    escalated: false,
    waitingForCustomer: false,
    messageSent: false,
  };
}

export async function executeInternalAction(
  context: OrchestratorContext,
  caseSolutionId: number,
  action: CaseAction
): Promise<ActionExecutionResult> {
  console.log(`[ActionExecutors] Executing internal action (marking as completed)`);

  await caseSolutionStorage.updateActionStatus(action.id, "completed", {
    output: { executedAsInternal: true, note: "Internal actions are marked complete automatically" },
  });

  context.lastDispatchLog = {
    solutionCenterResults: 0,
    aiDecision: "internal_action",
    aiReason: "Internal action executed",
    action: "internal_completed",
    details: { caseSolutionId, actionId: action.id },
  };

  return {
    success: true,
    solutionFound: true,
    caseSolutionId,
    actionExecuted: "internal_action",
    escalated: false,
    waitingForCustomer: false,
    messageSent: false,
  };
}

export async function executeSkipUnknown(
  caseSolutionId: number,
  action: CaseAction
): Promise<ActionExecutionResult> {
  console.log(`[ActionExecutors] Skipping unknown action type`);
  
  await caseSolutionStorage.updateActionStatus(action.id, "skipped", {
    output: { reason: "Unknown action type" },
  });
  
  return {
    success: true,
    solutionFound: true,
    caseSolutionId,
    actionExecuted: "skipped",
    escalated: false,
  };
}

async function callAIForMessage(
  context: OrchestratorContext,
  actionInfo: {
    actionDescription: string;
    actionValue: string | null;
    agentInstructions: string | null;
    waitForResponse: boolean;
  }
): Promise<(SolutionProviderAIResponse & { suggestionId?: number }) | null> {
  const { conversationId, event } = context;

  const systemPrompt = `Você é um assistente de atendimento ao cliente. Gere uma mensagem clara e amigável.

REGRAS:
- Escreva em português brasileiro
- Seja cordial e objetivo
- NÃO invente informações
- Se precisa de resposta, faça UMA pergunta clara

Responda APENAS em JSON: {"mensagem": "texto", "motivo": "explicação breve"}`;

  const actionTypeLabel = actionInfo.waitForResponse ? "PERGUNTA" : "INFORMAÇÃO";
  const userPrompt = `AÇÃO A EXECUTAR (${actionTypeLabel}):
- Descrição: ${actionInfo.actionDescription}
${actionInfo.actionValue ? `- Valor/Conteúdo: ${actionInfo.actionValue}` : ""}
${actionInfo.agentInstructions ? `- Instruções: ${actionInfo.agentInstructions}` : ""}

Gere a mensagem para o cliente.`;

  console.log(`[ActionExecutors] Calling AI for message generation`);

  const result = await callOpenAI({
    requestType: "solution_provider_message",
    modelName: "gpt-4o-mini",
    promptSystem: systemPrompt,
    promptUser: userPrompt,
    maxTokens: 500,
    contextType: "conversation",
    contextId: String(conversationId),
  });

  if (!result.success || !result.responseContent) {
    console.log(`[ActionExecutors] AI call failed: ${result.error}`);
    return null;
  }

  try {
    const jsonMatch = result.responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[ActionExecutors] No JSON in AI response`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as SolutionProviderAIResponse;
    if (!parsed.mensagem) {
      console.log(`[ActionExecutors] AI response missing 'mensagem'`);
      return null;
    }

    const saved = await saveSuggestedResponse(conversationId, parsed.mensagem, {
      externalConversationId: event.externalConversationId,
      lastEventId: event.id,
      openaiLogId: result.logId,
      inResponseTo: String(event.id),
      source: "solution_provider_orchestrator",
    });

    return {
      mensagem: parsed.mensagem,
      motivo: parsed.motivo,
      suggestionId: saved?.id,
    };
  } catch (parseError) {
    console.error(`[ActionExecutors] Failed to parse AI response:`, parseError);
    return null;
  }
}

export async function executeSendMessageAction(
  context: OrchestratorContext,
  caseSolutionId: number,
  action: CaseAction,
  waitForResponse: boolean,
  escalateFn: (context: OrchestratorContext, caseSolutionId: number, reason: string) => Promise<ActionExecutionResult>
): Promise<ActionExecutionResult> {
  const { conversationId, event } = context;

  const actionDescription = getActionDescription(action);
  const agentInstructions = getActionAgentInstructions(action);
  const actionValue = (action.inputUsed as Record<string, unknown>)?.value as string | null ?? null;

  console.log(`[ActionExecutors] Generating message for action: ${actionDescription}`);

  const clientHubData = await getClientHubData(context);
  const resolvedMessage = resolveMessageFromVariations(action, clientHubData);

  if (resolvedMessage.variationLabel) {
    console.log(`[ActionExecutors] Using variation: ${resolvedMessage.variationLabel}`);
  }

  let mensagem: string;
  let suggestionId: number | undefined;

  if (resolvedMessage.message) {
    console.log(`[ActionExecutors] Using pre-defined message from action`);
    mensagem = resolvedMessage.message;

    const saved = await saveSuggestedResponse(conversationId, mensagem, {
      externalConversationId: event.externalConversationId,
      lastEventId: event.id,
      inResponseTo: String(event.id),
      source: "solution_provider_orchestrator_predefined",
    });
    suggestionId = saved?.id;
  } else {
    console.log(`[ActionExecutors] Calling AI to generate message`);

    const aiResult = await callAIForMessage(context, {
      actionDescription,
      actionValue,
      agentInstructions: resolvedMessage.agentInstructions ?? agentInstructions,
      waitForResponse,
    });

    if (!aiResult || !aiResult.mensagem) {
      console.log(`[ActionExecutors] AI failed to generate message, escalating`);
      return await escalateFn(context, caseSolutionId, "AI failed to generate message");
    }

    mensagem = aiResult.mensagem;
    suggestionId = aiResult.suggestionId;
  }

  if (!suggestionId) {
    const saved = await saveSuggestedResponse(conversationId, mensagem, {
      externalConversationId: event.externalConversationId,
      lastEventId: event.id,
      inResponseTo: String(event.id),
    });
    suggestionId = saved?.id;
  }

  if (!suggestionId) {
    console.log(`[ActionExecutors] Failed to save message, escalating`);
    return await escalateFn(context, caseSolutionId, "Failed to save message");
  }

  const sendAction: OrchestratorAction = {
    type: "SEND_MESSAGE",
    payload: { suggestionId, responsePreview: mensagem.substring(0, 100) },
  };
  await ActionExecutor.execute(context, [sendAction]);

  if (waitForResponse) {
    await caseSolutionStorage.updateActionStatus(action.id, "in_progress", {
      output: { messageSent: true, waitingForResponse: true },
    });

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
      conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
      waitingForCustomer: true,
    });

    context.lastDispatchLog = {
      solutionCenterResults: 1,
      aiDecision: "ask_customer",
      aiReason: "Waiting for customer response",
      action: "message_sent_waiting",
      details: { caseSolutionId, actionId: action.id, suggestionId },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "ask_customer",
      escalated: false,
      waitingForCustomer: true,
      messageSent: true,
    };
  } else {
    await caseSolutionStorage.updateActionStatus(action.id, "completed", {
      output: { messageSent: true },
    });

    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.PROVIDING_SOLUTION,
      conversationOwner: CONVERSATION_OWNER.SOLUTION_PROVIDER,
      waitingForCustomer: false,
    });

    context.lastDispatchLog = {
      solutionCenterResults: 1,
      aiDecision: "inform_customer",
      aiReason: "Informed customer",
      action: "message_sent",
      details: { caseSolutionId, actionId: action.id, suggestionId },
    };

    return {
      success: true,
      solutionFound: true,
      caseSolutionId,
      actionExecuted: "inform_customer",
      escalated: false,
      waitingForCustomer: false,
      messageSent: true,
    };
  }
}
