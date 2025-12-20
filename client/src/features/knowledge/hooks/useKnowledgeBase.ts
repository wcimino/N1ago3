import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useKnowledgeQueries } from "./useKnowledgeQueries";
import { useKnowledgeMutations } from "./useKnowledgeMutations";
import { useKnowledgeHierarchy } from "./useKnowledgeHierarchy";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "./index";
import type { KnowledgeSubject, KnowledgeIntent } from "../../../types";

export type CatalogProduct = import("./useKnowledgeQueries").CatalogProduct;

export type { KnowledgeSubject, KnowledgeIntent };
export type { KnowledgeBaseArticle, KnowledgeBaseFormData };
export type { HierarchyNode } from "./useKnowledgeHierarchy";

export function useKnowledgeBase(activeTab: string) {
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedIntentId, setSelectedIntentId] = useState<number | null>(null);

  const handleProductChange = (product: string) => {
    setSelectedProduct(product);
    setSelectedSubjectId(null);
    setSelectedIntentId(null);
  };

  const handleSubjectChange = (subjectId: number | null) => {
    setSelectedSubjectId(subjectId);
    setSelectedIntentId(null);
  };

  const {
    articles,
    isLoading,
    catalogProducts,
    subjects,
    intents,
    filters,
    embeddingStats,
    intentStatistics,
  } = useKnowledgeQueries({
    activeTab,
    searchTerm,
    selectedProduct,
    selectedSubjectId,
    selectedIntentId,
  });

  const {
    createMutation,
    updateMutation,
    generateEmbeddingsMutation,
    handleSubmit: baseHandleSubmit,
    handleDelete,
  } = useKnowledgeMutations({
    onCreateSuccess: () => setShowForm(false),
    onUpdateSuccess: () => {
      setEditingArticle(null);
      setShowForm(false);
    },
  });

  const {
    hierarchy,
    expandedPaths,
    togglePath,
    expandAllPaths,
    collapseAllPaths,
    intentViewCountMap,
    catalogStats,
  } = useKnowledgeHierarchy({
    catalogProducts,
    subjects,
    intents,
    articles,
    intentStatistics,
    embeddingStats,
  });

  const handleSubmit = (data: KnowledgeBaseFormData) => {
    baseHandleSubmit(data, editingArticle);
  };

  const handleEdit = (article: KnowledgeBaseArticle) => {
    navigate(`/knowledge-base/article/${article.id}`);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingArticle(null);
  };

  const filteredSubjects = useMemo(() => {
    if (!selectedProduct) return [];
    const productIds = catalogProducts.filter(p => p.produto === selectedProduct).map(p => p.id);
    return subjects.filter(s => productIds.includes(s.productCatalogId));
  }, [selectedProduct, catalogProducts, subjects]);

  const filteredIntents = useMemo(() => {
    if (!selectedSubjectId) return [];
    return intents.filter(i => i.subjectId === selectedSubjectId);
  }, [selectedSubjectId, intents]);

  return {
    articles,
    isLoading,
    filters,
    hierarchy,
    showForm,
    setShowForm,
    editingArticle,
    searchTerm,
    setSearchTerm,
    selectedProduct,
    handleProductChange,
    selectedSubjectId,
    handleSubjectChange,
    selectedIntentId,
    setSelectedIntentId,
    filteredSubjects,
    filteredIntents,
    expandedPaths,
    createMutation,
    updateMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancel,
    togglePath,
    expandAllPaths,
    collapseAllPaths,
    subjects,
    intents,
    catalogStats,
    intentViewCountMap,
    generateEmbeddingsMutation,
    embeddingStats,
  };
}
