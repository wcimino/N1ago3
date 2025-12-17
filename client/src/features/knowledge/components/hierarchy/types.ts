import type { HierarchyNode, KnowledgeBaseArticle } from "../../hooks/useKnowledgeBase";

export interface BaseNodeProps {
  node: HierarchyNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
  onAddArticle?: (subjectId?: number, intentId?: number, fullPath?: string, productCatalogId?: number) => void;
  onAddSubject?: (productId: number) => void;
  onAddIntent?: (subjectId: number) => void;
  onEditIntent?: (intentId: number, intentName: string) => void;
  onEditSubject?: (subjectId: number, subjectName: string) => void;
  onDeleteSubject?: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onDeleteIntent?: (intentId: number, intentName: string, hasArticles: boolean) => void;
  parentName?: string;
  intentViewCountMap?: Map<number, number>;
}

export interface NodeActionButtonsProps {
  node: HierarchyNode;
  isProduct: boolean;
  isSubproduct: boolean;
  isAssunto: boolean;
  isIntencao: boolean;
  stats: { articleCount: number };
  onAddSubject?: (productId: number) => void;
  onAddIntent?: (subjectId: number) => void;
  onEditSubject?: (subjectId: number, subjectName: string) => void;
  onDeleteSubject?: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onEditIntent?: (intentId: number, intentName: string) => void;
  onDeleteIntent?: (intentId: number, intentName: string, hasArticles: boolean) => void;
  intentViewCountMap?: Map<number, number>;
}

export interface NodeStats {
  articleCount: number;
  subjectCount?: number;
  intentCount?: number;
}

export interface StatBadge {
  count: number;
  label: string;
}
