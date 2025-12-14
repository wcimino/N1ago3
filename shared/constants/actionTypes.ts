export const ACTION_TYPE_VALUES = {
  ASK_CUSTOMER: "ask_customer",
  INFORM_CUSTOMER: "inform_customer",
  TRANSFER_TO_HUMAN: "transfer_to_human",
  INTERNAL_ACTION_HUMAN: "internal_action_human",
  OTHER: "other",
} as const;

export type ActionTypeValue = typeof ACTION_TYPE_VALUES[keyof typeof ACTION_TYPE_VALUES];

export const ACTION_TYPE_LABELS: Record<string, string> = {
  [ACTION_TYPE_VALUES.ASK_CUSTOMER]: "Perguntar ao cliente",
  [ACTION_TYPE_VALUES.INFORM_CUSTOMER]: "Informar cliente",
  [ACTION_TYPE_VALUES.TRANSFER_TO_HUMAN]: "Transferir para humano",
  [ACTION_TYPE_VALUES.INTERNAL_ACTION_HUMAN]: "Ação interna manual",
  [ACTION_TYPE_VALUES.OTHER]: "Outro",
};

export const ACTION_TYPE_OPTIONS = [
  { value: ACTION_TYPE_VALUES.ASK_CUSTOMER, label: ACTION_TYPE_LABELS[ACTION_TYPE_VALUES.ASK_CUSTOMER] },
  { value: ACTION_TYPE_VALUES.INFORM_CUSTOMER, label: ACTION_TYPE_LABELS[ACTION_TYPE_VALUES.INFORM_CUSTOMER] },
  { value: ACTION_TYPE_VALUES.TRANSFER_TO_HUMAN, label: ACTION_TYPE_LABELS[ACTION_TYPE_VALUES.TRANSFER_TO_HUMAN] },
  { value: ACTION_TYPE_VALUES.INTERNAL_ACTION_HUMAN, label: ACTION_TYPE_LABELS[ACTION_TYPE_VALUES.INTERNAL_ACTION_HUMAN] },
  { value: ACTION_TYPE_VALUES.OTHER, label: ACTION_TYPE_LABELS[ACTION_TYPE_VALUES.OTHER] },
];

export function getActionTypeLabel(actionType: string): string {
  return ACTION_TYPE_LABELS[actionType] || actionType;
}
