import { Bot, Brain, UserCircle } from "lucide-react";

export const AUTH_FILTER_INFO: Record<string, { label: string; shortLabel: string }> = {
  all: { label: "Todos os clientes", shortLabel: "Todos" },
  authenticated: { label: "Apenas autenticados", shortLabel: "Autenticados" },
  unauthenticated: { label: "Apenas não autenticados", shortLabel: "Não autenticados" },
};

export const TARGET_INFO: Record<string, { label: string; icon: typeof Bot; bgClass: string; iconClass: string }> = {
  n1ago: { label: "N1ago", icon: Brain, bgClass: "bg-purple-100", iconClass: "text-purple-600" },
  human: { label: "Humano", icon: UserCircle, bgClass: "bg-amber-100", iconClass: "text-amber-600" },
  bot: { label: "Bot Zendesk", icon: Bot, bgClass: "bg-emerald-100", iconClass: "text-emerald-600" },
};

export const DEFAULT_NEW_CONV_FORM = {
  target: "n1ago",
  allocateCount: 10,
  authFilter: "all",
};

export const DEFAULT_ONGOING_CONV_FORM = {
  target: "n1ago",
  allocateCount: 10,
  matchText: "",
};
