export interface RoutingRule {
  id: number;
  ruleType: string;
  target: string;
  allocateCount: number | null;
  allocatedCount: number;
  isActive: boolean;
  authFilter: string;
  matchText: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export type FormType = "new_conversation" | "ongoing_conversation" | null;

export interface NewConvFormData {
  target: string;
  allocateCount: number;
  authFilter: string;
}

export interface OngoingConvFormData {
  target: string;
  allocateCount: number;
  matchText: string;
}
