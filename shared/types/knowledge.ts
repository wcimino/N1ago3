export interface ProductCatalogItem {
  id: number;
  externalId: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface SubproductCatalogItem {
  id: number;
  externalId: string;
  name: string;
  produtoId: string;
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
