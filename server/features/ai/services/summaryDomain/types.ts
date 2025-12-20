export interface ObjectiveProblemResult {
  id: number;
  name: string;
  matchScore?: number;
  matchedTerms?: string[];
}

export interface ClientRequestVersions {
  clientRequestStandardVersion?: string;
  clientRequestQuestionVersion?: string;
  clientRequestProblemVersion?: string;
}

export interface SearchQueryQuality {
  isGeneric?: boolean;
  missingKeyInfo?: string | null;
}

export interface TriageAnamnese {
  customerMainComplaint?: string;
}

export interface Triage {
  anamnese?: TriageAnamnese;
}

export interface ParsedSummary {
  clientRequest?: string;
  importantInfo?: string;
  agentActions?: string;
  currentStatus?: string;
  customerEmotionLevel?: number;
  customerRequestType?: string;
  clientRequestVersions?: ClientRequestVersions;
  clientRequestVerbatimSearchQuery?: string;
  clientRequestKeywordSearchQuery?: string;
  clientRequestNormalizedSearchQuery?: string;
  clientRequestSearchQueryQuality?: SearchQueryQuality;
  triage?: Triage;
  objectiveProblems?: ObjectiveProblemResult[];
  [key: string]: unknown;
}

export interface SearchQueries {
  verbatimQuery?: string;
  keywordQuery?: string;
  normalizedQuery?: string;
}
