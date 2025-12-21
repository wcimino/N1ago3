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
