import type { KnowledgeBaseObjectiveProblem } from "../../../../../shared/schema.js";

export type ObjectiveProblemWithProducts = KnowledgeBaseObjectiveProblem & {
  productIds: number[];
};

export type ProblemWithProductNames = KnowledgeBaseObjectiveProblem & { 
  productNames?: string[] 
};

export interface SearchObjectiveProblemsParams {
  keywords?: string;
  productId?: number;
  onlyActive?: boolean;
  onlyVisibleInSearch?: boolean;
  limit?: number;
}

export interface ObjectiveProblemSearchResult {
  id: number;
  name: string;
  description: string;
  synonyms: string[];
  examples: string[];
  matchScore: number;
  matchReason: string;
  productIds: number[];
  productNames: string[];
}

export interface SemanticSearchParams {
  queryEmbedding: number[];
  productId?: number;
  onlyActive?: boolean;
  onlyVisibleInSearch?: boolean;
  limit?: number;
}

export interface SemanticSearchResult {
  id: number;
  name: string;
  description: string;
  synonyms: string[];
  examples: string[];
  similarity: number;
  productIds: number[];
  productNames: string[];
}

export interface ObjectiveProblemStats {
  totalProblems: number;
  activeProblems: number;
  withEmbedding: number;
  withoutEmbedding: number;
}
