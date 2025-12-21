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
  triage?: Triage | null;
  orchestrator_status?: string | null;
  demand_finder_status?: string | null;
}

export type { Triage, ObjectiveProblemIdentified };
