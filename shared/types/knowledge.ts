export interface ProductCatalogItem {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

export interface KnowledgeSubject {
  id: number;
  productCatalogId: number;
  name: string;
  synonyms: string[];
  productName?: string | null;
}

export interface KnowledgeIntent {
  id: number;
  subjectId: number;
  name: string;
  synonyms: string[];
  subjectName?: string | null;
}

export interface KnowledgeArticle {
  id: number;
  name: string;
  description: string | null;
  resolution: string | null;
  observations: string | null;
  question: string | null;
  questionNormalized: string | null;
  answer: string | null;
  keywords: string | null;
  questionVariation: string[] | null;
}

export interface KnowledgeBaseAction {
  id: number;
  actionType: string;
  description: string;
  requiredInput: string | null;
  messageTemplate: string | null;
  ownerTeam: string | null;
  sla: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SolutionAction extends KnowledgeBaseAction {
  actionSequence: number;
}

export interface KnowledgeBaseSolution {
  id: number;
  name: string;
  description: string | null;
  productId: number | null;
  isActive: boolean;
  isFallback: boolean;
  isArticleDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SolutionWithActions extends KnowledgeBaseSolution {
  actions: SolutionAction[];
}

export interface ObjectiveProblem {
  id: number;
  name: string;
  problemNormalized: string | null;
  description: string;
  synonyms: string[];
  examples: string[];
  presentedBy: "customer" | "system" | "both";
  isActive: boolean;
  visibleInSearch: boolean;
  availableForAutoReply: boolean;
  productIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveProblemStats {
  totalProblems: number;
  activeProblems: number;
  withEmbedding: number;
  withoutEmbedding: number;
}

export interface ActionStats {
  total: number;
  active: number;
  inactive: number;
}

export interface EnrichmentLog {
  id: number;
  intentId: number;
  articleId: number | null;
  action: string;
  outcomeReason: string | null;
  suggestionId: number | null;
  sourceArticles: Array<{ id: string; title: string; similarityScore: number }> | null;
  confidenceScore: number | null;
  productStandard: string | null;
  outcomePayload: any;
  openaiLogId: number | null;
  triggerRunId: string | null;
  processedAt: string;
  createdAt: string;
}

export interface ProductNode {
  id: number;
  name: string;
  fullPath: string;
  children: ProductNode[];
  subjects: KnowledgeSubject[];
}
