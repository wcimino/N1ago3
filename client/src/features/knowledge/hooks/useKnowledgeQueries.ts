import { useQuery } from "@tanstack/react-query";
import type { KnowledgeSubject, KnowledgeIntent, ProductCatalogItem } from "../../../types";

export type CatalogProduct = ProductCatalogItem;

export interface KnowledgeBaseArticle {
  id: number;
  question: string | null;
  answer: string | null;
  keywords: string | null;
  questionVariation: string[] | null;
  productId: number | null;
  subjectId: number | null;
  intentId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Filters {
  products: number[];
}

export interface EmbeddingStats {
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  outdated: number;
}

export interface IntentStatistic {
  intentId: number;
  viewCount: number;
}

interface UseKnowledgeQueriesOptions {
  activeTab: string;
  searchTerm: string;
  selectedProduct: string;
  selectedSubjectId: number | null;
  selectedIntentId: number | null;
}

export function useKnowledgeQueries({
  activeTab,
  searchTerm,
  selectedProduct,
  selectedSubjectId,
  selectedIntentId,
}: UseKnowledgeQueriesOptions) {
  const isArticlesTab = activeTab === "articles";

  const { data: articles = [], isLoading } = useQuery<KnowledgeBaseArticle[]>({
    queryKey: ["/api/knowledge/articles", searchTerm, selectedProduct, selectedSubjectId, selectedIntentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedProduct) params.set("productStandard", selectedProduct);
      if (selectedSubjectId) params.set("subjectId", selectedSubjectId.toString());
      if (selectedIntentId) params.set("intentId", selectedIntentId.toString());
      const res = await fetch(`/api/knowledge/articles?${params}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: catalogProducts = [] } = useQuery<CatalogProduct[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: subjects = [] } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects", { withProduct: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/subjects?withProduct=true");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: intents = [] } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents", { withSubject: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/intents?withSubject=true");
      if (!res.ok) throw new Error("Failed to fetch intents");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: filters } = useQuery<Filters>({
    queryKey: ["/api/knowledge/articles/filters"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/articles/filters");
      if (!res.ok) throw new Error("Failed to fetch filters");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: embeddingStats } = useQuery<EmbeddingStats>({
    queryKey: ["/api/knowledge/embeddings/stats"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/embeddings/stats");
      if (!res.ok) throw new Error("Failed to fetch embedding stats");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  const { data: intentStatistics = [] } = useQuery<IntentStatistic[]>({
    queryKey: ["/api/knowledge/articles/statistics/by-intent"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/articles/statistics/by-intent");
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json();
    },
    enabled: isArticlesTab,
  });

  return {
    articles,
    isLoading,
    catalogProducts,
    subjects,
    intents,
    filters,
    embeddingStats,
    intentStatistics,
  };
}
