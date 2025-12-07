export const AUTHOR_TYPE_OPTIONS = [
  { value: "customer", label: "Cliente" },
  { value: "agent", label: "Agente" },
  { value: "bot", label: "Bot" },
  { value: "system", label: "Sistema" },
] as const;

export const MODEL_OPTIONS = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
] as const;

export const INTENT_LABELS: Record<string, string> = {
  contratar: "Quer contratar",
  suporte: "Precisa de suporte",
  cancelar: "Quer cancelar",
  duvida: "Tem dúvidas",
  reclamacao: "Reclamação",
  outros: "Outros",
};

export const INTENT_COLORS: Record<string, string> = {
  contratar: "bg-green-100 text-green-700",
  suporte: "bg-blue-100 text-blue-700",
  cancelar: "bg-red-100 text-red-700",
  duvida: "bg-yellow-100 text-yellow-700",
  reclamacao: "bg-orange-100 text-orange-700",
  outros: "bg-gray-100 text-gray-700",
};
