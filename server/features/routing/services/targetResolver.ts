import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";

export const VALID_TARGETS = ["n1ago", "human", "bot"] as const;
export type ValidTarget = typeof VALID_TARGETS[number];

const HANDLER_NAMES: Record<ValidTarget, string> = {
  n1ago: "n1ago",
  human: "zd-agentWorkspace",
  bot: "zd-answerBot",
};

export function getIntegrationId(target: string): string | null {
  const normalizedTarget = target.toLowerCase();
  
  switch (normalizedTarget) {
    case "n1ago":
      return ZendeskApiService.getN1agoIntegrationId();
    case "human":
      return ZendeskApiService.getAgentWorkspaceIntegrationId();
    case "bot":
      return ZendeskApiService.getAnswerBotIntegrationId();
    default:
      return null;
  }
}

export function getHandlerName(target: string): string | null {
  const normalizedTarget = target.toLowerCase() as ValidTarget;
  return HANDLER_NAMES[normalizedTarget] ?? null;
}

export function isN1ago(integrationIdOrName: string): boolean {
  if (!integrationIdOrName) return false;
  
  const n1agoIntegrationId = ZendeskApiService.getN1agoIntegrationId();
  const normalized = integrationIdOrName.toLowerCase();
  
  return integrationIdOrName === n1agoIntegrationId || normalized.includes("n1ago");
}

export function isValidTarget(target: string): target is ValidTarget {
  return VALID_TARGETS.includes(target.toLowerCase() as ValidTarget);
}

export function isHuman(target: string): boolean {
  return target.toLowerCase() === "human";
}

export const TargetResolver = {
  getIntegrationId,
  getHandlerName,
  isN1ago,
  isHuman,
  isValidTarget,
  VALID_TARGETS,
};
