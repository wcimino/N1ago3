import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductLevelType } from "../../../lib/productHierarchy";

export interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  subjectId: number | null;
  intentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseFormData {
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  subjectId: number | null;
  intentId: number | null;
}

interface Filters {
  products: string[];
}

export interface CatalogProduct {
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

export interface HierarchyNode {
  name: string;
  level: ProductLevelType;
  fullPath: string;
  children: HierarchyNode[];
  articles: KnowledgeBaseArticle[];
  subjectId?: number;
  intentId?: number;
}

function buildHierarchy(
  products: CatalogProduct[],
  subjects: KnowledgeSubject[],
  intents: KnowledgeIntent[],
  articles: KnowledgeBaseArticle[]
): HierarchyNode[] {
  const productNodes = new Map<string, HierarchyNode>();
  const subjectToProduct = new Map<number, string>();
  
  for (const product of products) {
    if (!productNodes.has(product.produto)) {
      productNodes.set(product.produto, {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
      });
    }
  }
  
  for (const subject of subjects) {
    const product = products.find(p => p.id === subject.productCatalogId);
    if (!product) continue;
    
    subjectToProduct.set(subject.id, product.produto);
    
    let prodNode = productNodes.get(product.produto);
    if (!prodNode) {
      prodNode = {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
      };
      productNodes.set(product.produto, prodNode);
    }
    
    let subjectNode = prodNode.children.find(c => c.subjectId === subject.id);
    if (!subjectNode) {
      subjectNode = {
        name: subject.name,
        level: "assunto",
        fullPath: `${product.produto} > ${subject.name}`,
        children: [],
        articles: [],
        subjectId: subject.id,
      };
      prodNode.children.push(subjectNode);
    }
  }
  
  for (const intent of intents) {
    const productName = subjectToProduct.get(intent.subjectId);
    if (!productName) continue;
    
    const prodNode = productNodes.get(productName);
    if (!prodNode) continue;
    
    const subjectNode = prodNode.children.find(c => c.subjectId === intent.subjectId);
    if (!subjectNode) continue;
    
    let intentNode = subjectNode.children.find(c => c.intentId === intent.id);
    if (!intentNode) {
      intentNode = {
        name: intent.name,
        level: "intencao",
        fullPath: `${subjectNode.fullPath} > ${intent.name}`,
        children: [],
        articles: [],
        intentId: intent.id,
      };
      subjectNode.children.push(intentNode);
    }
  }
  
  for (const article of articles) {
    if (article.intentId) {
      let placed = false;
      for (const prodNode of productNodes.values()) {
        for (const subjectNode of prodNode.children) {
          const intentNode = subjectNode.children.find(c => c.intentId === article.intentId);
          if (intentNode) {
            intentNode.articles.push(article);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        const prodNode = productNodes.get(article.productStandard);
        if (prodNode) {
          prodNode.articles.push(article);
        }
      }
    } else if (article.subjectId) {
      let placed = false;
      for (const prodNode of productNodes.values()) {
        const subjectNode = prodNode.children.find(c => c.subjectId === article.subjectId);
        if (subjectNode) {
          subjectNode.articles.push(article);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const prodNode = productNodes.get(article.productStandard);
        if (prodNode) {
          prodNode.articles.push(article);
        }
      }
    } else {
      const prodNode = productNodes.get(article.productStandard);
      if (prodNode) {
        prodNode.articles.push(article);
      } else {
        if (!productNodes.has(article.productStandard)) {
          productNodes.set(article.productStandard, {
            name: article.productStandard,
            level: "produto",
            fullPath: article.productStandard,
            children: [],
            articles: [],
          });
        }
        productNodes.get(article.productStandard)!.articles.push(article);
      }
    }
  }
  
  return Array.from(productNodes.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useKnowledgeBase(activeTab: string) {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedIntentId, setSelectedIntentId] = useState<number | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const handleProductChange = (product: string) => {
    setSelectedProduct(product);
    setSelectedSubjectId(null);
    setSelectedIntentId(null);
  };

  const handleSubjectChange = (subjectId: number | null) => {
    setSelectedSubjectId(subjectId);
    setSelectedIntentId(null);
  };

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
    enabled: activeTab === "articles",
  });

  const { data: catalogProducts = [] } = useQuery<CatalogProduct[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const { data: subjects = [] } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects", { withProduct: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/subjects?withProduct=true");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const { data: intents = [] } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents", { withSubject: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/intents?withSubject=true");
      if (!res.ok) throw new Error("Failed to fetch intents");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const { data: filters } = useQuery<Filters>({
    queryKey: ["/api/knowledge/articles/filters"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/articles/filters");
      if (!res.ok) throw new Error("Failed to fetch filters");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const hierarchy = useMemo(() => buildHierarchy(catalogProducts, subjects, intents, articles), [catalogProducts, subjects, intents, articles]);

  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeBaseFormData) => {
      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: KnowledgeBaseFormData & { id: number }) => {
      const res = await fetch(`/api/knowledge/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
      setEditingArticle(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/articles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const handleSubmit = (data: KnowledgeBaseFormData) => {
    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (article: KnowledgeBaseArticle) => {
    setEditingArticle(article);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este artigo?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingArticle(null);
  };

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
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
    subjects,
    intents,
  };
}
