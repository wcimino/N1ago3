import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProductCatalogItem, KnowledgeSubject, KnowledgeIntent } from "../../types";

export interface ProductHierarchySelection {
  productId: number | null;
  subjectId: number | null;
  intentId: number | null;
}

export interface ProductHierarchyOptions {
  includeSubjects?: boolean;
  includeIntents?: boolean;
  initialValues?: Partial<ProductHierarchySelection>;
}

export interface ProductHierarchyResult {
  selection: ProductHierarchySelection;
  setProductId: (productId: number | null) => void;
  setSubjectId: (subjectId: number | null) => void;
  setIntentId: (intentId: number | null) => void;
  setSelection: (selection: ProductHierarchySelection) => void;
  resetSelection: () => void;
  products: ProductCatalogItem[];
  uniqueProducts: ProductCatalogItem[];
  subjects: KnowledgeSubject[];
  filteredSubjects: KnowledgeSubject[];
  intents: KnowledgeIntent[];
  filteredIntents: KnowledgeIntent[];
  isLoading: boolean;
  isReady: boolean;
  getProductName: (productId: number | null) => string;
  getSubjectName: (subjectId: number | null) => string;
  getIntentName: (intentId: number | null) => string;
}

export function useProductHierarchySelects(
  options: ProductHierarchyOptions = {}
): ProductHierarchyResult {
  const { 
    includeSubjects = true, 
    includeIntents = true,
    initialValues 
  } = options;

  const [selection, setSelectionState] = useState<ProductHierarchySelection>({
    productId: initialValues?.productId ?? null,
    subjectId: initialValues?.subjectId ?? null,
    intentId: initialValues?.intentId ?? null,
  });

  useEffect(() => {
    if (initialValues) {
      setSelectionState({
        productId: initialValues.productId ?? null,
        subjectId: initialValues.subjectId ?? null,
        intentId: initialValues.intentId ?? null,
      });
    }
  }, [initialValues?.productId, initialValues?.subjectId, initialValues?.intentId]);

  const { data: catalogProducts = [], isSuccess: catalogLoaded } = useQuery<ProductCatalogItem[]>({
    queryKey: ["/api/product-catalog"],
  });

  const { data: allSubjects = [], isSuccess: subjectsLoaded } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects?withProduct=true"],
    enabled: includeSubjects,
  });

  const { data: allIntents = [], isSuccess: intentsLoaded } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents?withSubject=true"],
    enabled: includeIntents,
  });

  const isLoading = !catalogLoaded || (includeSubjects && !subjectsLoaded) || (includeIntents && !intentsLoaded);
  const isReady = catalogLoaded && (!includeSubjects || subjectsLoaded) && (!includeIntents || intentsLoaded);

  const uniqueProducts = useMemo(() => {
    const seen = new Set<number>();
    return catalogProducts.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [catalogProducts]);

  const filteredSubjects = useMemo(() => {
    if (!selection.productId) return [];
    return allSubjects.filter(s => s.productCatalogId === selection.productId);
  }, [selection.productId, allSubjects]);

  const filteredIntents = useMemo(() => {
    if (!selection.subjectId) return [];
    return allIntents.filter(i => i.subjectId === selection.subjectId);
  }, [selection.subjectId, allIntents]);

  const setProductId = useCallback((productId: number | null) => {
    setSelectionState(prev => ({
      ...prev,
      productId,
      subjectId: null,
      intentId: null,
    }));
  }, []);

  const setSubjectId = useCallback((subjectId: number | null) => {
    setSelectionState(prev => ({
      ...prev,
      subjectId,
      intentId: null,
    }));
  }, []);

  const setIntentId = useCallback((intentId: number | null) => {
    setSelectionState(prev => ({ ...prev, intentId }));
  }, []);

  const setSelection = useCallback((newSelection: ProductHierarchySelection) => {
    setSelectionState(newSelection);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectionState({
      productId: null,
      subjectId: null,
      intentId: null,
    });
  }, []);

  const getProductName = useCallback((productId: number | null) => {
    if (!productId) return "";
    const product = catalogProducts.find(p => p.id === productId);
    return product?.produto || "";
  }, [catalogProducts]);

  const getSubjectName = useCallback((subjectId: number | null) => {
    if (!subjectId) return "";
    const subject = allSubjects.find(s => s.id === subjectId);
    return subject?.name || "";
  }, [allSubjects]);

  const getIntentName = useCallback((intentId: number | null) => {
    if (!intentId) return "";
    const intent = allIntents.find(i => i.id === intentId);
    return intent?.name || "";
  }, [allIntents]);

  return {
    selection,
    setProductId,
    setSubjectId,
    setIntentId,
    setSelection,
    resetSelection,
    products: catalogProducts,
    uniqueProducts,
    subjects: allSubjects,
    filteredSubjects,
    intents: allIntents,
    filteredIntents,
    isLoading,
    isReady,
    getProductName,
    getSubjectName,
    getIntentName,
  };
}
