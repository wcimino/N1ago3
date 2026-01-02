import type { Triage, ObjectiveProblemIdentified } from "../../types/conversations";

export interface ClientRequestVersions {
  clientRequestStandardVersion?: string;
  clientRequestQuestionVersion?: string;
  clientRequestProblemVersion?: string;
}

export interface SolutionCenterResult {
  type: "article" | "problem";
  id: string;
  name: string;
  score: number;
  confidence?: number;
  reason?: string;
}

export interface OrchestratorLogEntry {
  turn: number;
  timestamp: string;
  agent: string;
  state: {
    status: string;
    owner: string | null;
    waitingForCustomer: boolean;
  };
  solutionCenterResults: number;
  aiDecision: string | null;
  aiReason: string | null;
  action: string;
  details?: Record<string, unknown>;
}

export interface ClientHubProduct {
  name: string;
  icon?: string;
  color?: string;
}

export interface ClientHubSubproduct {
  name: string;
}

export interface ClientHubField {
  label: string;
  value: string;
  dataType: string;
  category: string;
  product?: ClientHubProduct;
  subproduct?: ClientHubSubproduct;
}

export interface ClientHubData {
  cnpj?: string;
  cnpjValido?: boolean;
  campos?: Record<string, ClientHubField>;
  fetchedAt?: string;
}

export type StageStatus = "pending" | "running" | "completed" | "error";

export interface StageProgress {
  summary: { status: StageStatus; updatedAt?: string };
  classification: { status: StageStatus; updatedAt?: string };
  demandFinder: { status: StageStatus; updatedAt?: string };
  solutionProvider: { status: StageStatus; updatedAt?: string };
}

export interface SummaryData {
  product?: string | null;
  subproduct?: string | null;
  product_confidence?: number | null;
  product_confidence_reason?: string | null;
  text?: string | null;
  client_request?: string | null;
  client_request_versions?: ClientRequestVersions | null;
  agent_actions?: string | null;
  current_status?: string | null;
  important_info?: string | null;
  customer_emotion_level?: number | null;
  customer_request_type?: string | null;
  customer_request_type_confidence?: number | null;
  customer_request_type_reason?: string | null;
  objective_problems?: ObjectiveProblemIdentified[] | null;
  solution_center_articles_and_problems?: SolutionCenterResult[] | null;
  solution_center_selected_id?: string | null;
  solution_center_selected_reason?: string | null;
  solution_center_selected_confidence?: number | null;
  triage?: Triage | null;
  orchestrator_status?: string | null;
  demand_finder_status?: string | null;
  demand_finder_interaction_count?: number | null;
  conversation_orchestrator_log?: OrchestratorLogEntry[] | null;
  client_hub_data?: ClientHubData | null;
  stage_progress?: StageProgress | null;
}

export type { Triage, ObjectiveProblemIdentified };
