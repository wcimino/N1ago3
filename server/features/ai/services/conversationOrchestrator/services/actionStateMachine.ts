import type { SolutionCenterActionType } from "../types.js";
import type { CaseAction as DrizzleCaseAction } from "../../../../../../shared/schema/knowledge.js";

export type ActionStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export type CaseAction = DrizzleCaseAction;

export const ACTION_CATEGORIES = {
  AUTOMATIC: ["consultar_perfil_cliente", "transferir_humano", "transferir_para_humano"],
  REQUIRES_MESSAGE: ["informar_cliente", "instruction", "link"],
  REQUIRES_CUSTOMER_INPUT: ["perguntar_ao_cliente"],
  INTERNAL: ["acao_interna_manual", "api_call"],
  FALLBACK: ["outro"],
} as const;

export function getActionType(action: CaseAction): SolutionCenterActionType {
  const input = action.inputUsed;
  const actionType = input?.actionType || input?.type || "outro";
  return String(actionType).toLowerCase() as SolutionCenterActionType;
}

export function isAutomaticAction(action: CaseAction): boolean {
  const type = getActionType(action);
  return ACTION_CATEGORIES.AUTOMATIC.includes(type as any);
}

export function requiresCustomerMessage(action: CaseAction): boolean {
  const type = getActionType(action);
  return ACTION_CATEGORIES.REQUIRES_MESSAGE.includes(type as any);
}

export function requiresCustomerInput(action: CaseAction): boolean {
  const type = getActionType(action);
  return ACTION_CATEGORIES.REQUIRES_CUSTOMER_INPUT.includes(type as any);
}

export function isInternalAction(action: CaseAction): boolean {
  const type = getActionType(action);
  return ACTION_CATEGORIES.INTERNAL.includes(type as any);
}

export function selectNextAction(actions: CaseAction[]): CaseAction | null {
  const inProgress = actions.find(a => a.status === "in_progress");
  if (inProgress) return inProgress;

  const sortedPending = actions
    .filter(a => a.status === "pending")
    .sort((a, b) => a.actionSequence - b.actionSequence);

  return sortedPending[0] || null;
}

export function allActionsCompleted(actions: CaseAction[]): boolean {
  if (actions.length === 0) return false;
  return actions.every(a => a.status === "completed" || a.status === "skipped");
}

export function hasFailedActions(actions: CaseAction[]): boolean {
  return actions.some(a => a.status === "failed");
}

export function getActionDescription(action: CaseAction): string {
  const input = action.inputUsed;
  return String(input?.name || input?.description || input?.value || "Ação sem descrição");
}

export function getActionValue(action: CaseAction): string | null {
  const input = action.inputUsed;
  return input?.value ? String(input.value) : null;
}

export function getActionAgentInstructions(action: CaseAction): string | null {
  const input = action.inputUsed;
  return input?.agentInstructions ? String(input.agentInstructions) : null;
}

export interface ActionDecision {
  action: CaseAction;
  decision: 
    | "execute_automatic"
    | "send_message_to_customer"
    | "ask_customer_for_input"
    | "execute_internal"
    | "skip_unknown"
    | "transfer_to_human";
  requiresAI: boolean;
  waitForCustomer: boolean;
}

export function decideActionExecution(action: CaseAction): ActionDecision {
  const type = getActionType(action);

  if (type === "transferir_humano" || type === "transferir_para_humano") {
    return {
      action,
      decision: "transfer_to_human",
      requiresAI: false,
      waitForCustomer: false,
    };
  }

  if (type === "consultar_perfil_cliente") {
    return {
      action,
      decision: "execute_automatic",
      requiresAI: false,
      waitForCustomer: false,
    };
  }

  if (requiresCustomerInput(action)) {
    return {
      action,
      decision: "ask_customer_for_input",
      requiresAI: true,
      waitForCustomer: true,
    };
  }

  if (requiresCustomerMessage(action)) {
    return {
      action,
      decision: "send_message_to_customer",
      requiresAI: true,
      waitForCustomer: false,
    };
  }

  if (isInternalAction(action)) {
    return {
      action,
      decision: "execute_internal",
      requiresAI: false,
      waitForCustomer: false,
    };
  }

  return {
    action,
    decision: "skip_unknown",
    requiresAI: false,
    waitForCustomer: false,
  };
}
