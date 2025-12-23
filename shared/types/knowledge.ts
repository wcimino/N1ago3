export interface ProductCatalogItem {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

export interface KnowledgeSubject {
  id: number;
  name: string;
  productCatalogId: number;
}

export interface KnowledgeIntent {
  id: number;
  name: string;
  subjectId: number;
}
