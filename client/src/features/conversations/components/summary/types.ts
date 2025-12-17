import type { Triage, ObjectiveProblemIdentified, ArticleAndProblemResult } from "../../types/conversations";

export interface ClientRequestVersions {
  clientRequestStandardVersion?: string;
  clientRequestQuestionVersion?: string;
  clientRequestProblemVersion?: string;
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
  articles_and_objective_problems?: ArticleAndProblemResult[] | null;
  triage?: Triage | null;
  orchestrator_status?: string | null;
  demand_finder_status?: string | null;
}

export type { Triage, ObjectiveProblemIdentified, ArticleAndProblemResult };
