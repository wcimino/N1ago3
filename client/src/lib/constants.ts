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
