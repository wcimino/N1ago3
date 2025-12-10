import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductLevelType } from "../../../lib/productHierarchy";
import type { KnowledgeSubject, KnowledgeIntent, ProductCatalogItem } from "../../../types";

export type CatalogProduct = ProductCatalogItem;

export interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  description: string;
  resolution: string;
  internalActions: string | null;
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
  description: string;
  resolution: string;
  internalActions: string | null;
  observations: string | null;
  subjectId: number | null;
  intentId: number | null;
}

interface Filters {
  products: string[];
}

export type { KnowledgeSubject, KnowledgeIntent };

export interface HierarchyNode {
  name: string;
  level: ProductLevelType;
  fullPath: string;
  children: HierarchyNode[];
  articles: KnowledgeBaseArticle[];
  productId?: number;
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
  const subproductNodes = new Map<string, HierarchyNode>();
  
  for (const product of products) {
    const isGenericProduct = !product.subproduto;
    
    if (!productNodes.has(product.produto)) {
      productNodes.set(product.produto, {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
        productId: isGenericProduct ? product.id : undefined,
      });
    } else {
      const existingNode = productNodes.get(product.produto)!;
      if (isGenericProduct && !existingNode.productId) {
        existingNode.productId = product.id;
      }
    }
    
    if (product.subproduto) {
      const prodNode = productNodes.get(product.produto)!;
      const subprodKey = `${product.produto}|${product.subproduto}`;
      if (!subproductNodes.has(subprodKey)) {
        const subprodNode: HierarchyNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
          productId: product.id,
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      } else {
        const existingSubprod = subproductNodes.get(subprodKey)!;
        if (!existingSubprod.productId) {
          existingSubprod.productId = product.id;
        }
      }
    }
  }
  
  for (const subject of subjects) {
    const product = products.find(p => p.id === subject.productCatalogId);
    if (!product) continue;
    
    const isGenericProduct = !product.subproduto;
    
    let prodNode = productNodes.get(product.produto);
    if (!prodNode) {
      const genericProduct = products.find(p => p.produto === product.produto && !p.subproduto);
      prodNode = {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
        productId: genericProduct?.id,
      };
      productNodes.set(product.produto, prodNode);
    } else if (isGenericProduct && !prodNode.productId) {
      prodNode.productId = product.id;
    }
    
    let parentNode: HierarchyNode = prodNode;
    let basePath = product.produto;
    
    if (product.subproduto) {
      const subprodKey = `${product.produto}|${product.subproduto}`;
      let subprodNode = subproductNodes.get(subprodKey);
      if (!subprodNode) {
        subprodNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
          productId: product.id,
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      } else if (!subprodNode.productId) {
        subprodNode.productId = product.id;
      }
      parentNode = subprodNode;
      basePath = `${product.produto} > ${product.subproduto}`;
    }
    
    let subjectNode = parentNode.children.find(c => c.subjectId === subject.id);
    if (!subjectNode) {
      subjectNode = {
        name: subject.name,
        level: "assunto",
        fullPath: `${basePath} > ${subject.name}`,
        children: [],
        articles: [],
        subjectId: subject.id,
      };
      parentNode.children.push(subjectNode);
    }
  }
  
  const findSubjectNode = (subjectId: number): HierarchyNode | null => {
    for (const prodNode of productNodes.values()) {
      const directSubject = prodNode.children.find(c => c.subjectId === subjectId);
      if (directSubject) return directSubject;
      
      for (const child of prodNode.children) {
        if (child.level === "subproduto") {
          const subjectInSubprod = child.children.find(c => c.subjectId === subjectId);
          if (subjectInSubprod) return subjectInSubprod;
        }
      }
    }
    return null;
  };
  
  for (const intent of intents) {
    const subjectNode = findSubjectNode(intent.subjectId);
    if (!subjectNode) continue;
    
    let intentNode = subjectNode.children.find(c => c.intentId === intent.id);
    if (!intentNode) {
      intentNode = {
        name: intent.name,
        level: "intencao",
        fullPath: `${subjectNode.fullPath} > ${intent.name}`,
        children: [],
        articles: [],
        subjectId: intent.subjectId,
        intentId: intent.id,
      };
      subjectNode.children.push(intentNode);
    }
  }
  
  const findIntentNode = (intentId: number): HierarchyNode | null => {
    for (const prodNode of productNodes.values()) {
      for (const child of prodNode.children) {
        if (child.level === "assunto") {
          const intentNode = child.children.find(c => c.intentId === intentId);
          if (intentNode) return intentNode;
        } else if (child.level === "subproduto") {
          for (const subjectNode of child.children) {
            const intentNode = subjectNode.children.find(c => c.intentId === intentId);
            if (intentNode) return intentNode;
          }
        }
      }
    }
    return null;
  };
  
  const placeArticleInFallback = (article: KnowledgeBaseArticle) => {
    const prodNode = productNodes.get(article.productStandard);
    if (!prodNode) {
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
      return;
    }
    
    if (article.subproductStandard) {
      const subprodKey = `${article.productStandard}|${article.subproductStandard}`;
      let subprodNode = subproductNodes.get(subprodKey);
      if (!subprodNode) {
        subprodNode = {
          name: article.subproductStandard,
          level: "subproduto",
          fullPath: `${article.productStandard} > ${article.subproductStandard}`,
          children: [],
          articles: [],
        };
        subproductNodes.set(subprodKey, subprodNode);
        prodNode.children.push(subprodNode);
      }
      subprodNode.articles.push(article);
    } else {
      prodNode.articles.push(article);
    }
  };
  
  for (const article of articles) {
    if (article.intentId) {
      const intentNode = findIntentNode(article.intentId);
      if (intentNode) {
        intentNode.articles.push(article);
      } else {
        placeArticleInFallback(article);
      }
    } else if (article.subjectId) {
      const subjectNode = findSubjectNode(article.subjectId);
      if (subjectNode) {
        subjectNode.articles.push(article);
      } else {
        placeArticleInFallback(article);
      }
    } else {
      placeArticleInFallback(article);
    }
  }
  
  const sortNodeRecursively = (node: HierarchyNode): void => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    node.articles.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    for (const child of node.children) {
      sortNodeRecursively(child);
    }
  };

  const result = Array.from(productNodes.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const node of result) {
    sortNodeRecursively(node);
  }
  return result;
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

  const getAllPaths = (nodes: HierarchyNode[]): string[] => {
    const paths: string[] = [];
    const collect = (n: HierarchyNode) => {
      paths.push(n.fullPath);
      n.children.forEach(collect);
    };
    nodes.forEach(collect);
    return paths;
  };

  const expandAllPaths = () => {
    const allPaths = getAllPaths(hierarchy);
    setExpandedPaths(new Set(allPaths));
  };

  const collapseAllPaths = () => {
    setExpandedPaths(new Set());
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

  const { data: embeddingStats } = useQuery<{ total: number; withEmbedding: number; withoutEmbedding: number; outdated: number }>({
    queryKey: ["/api/knowledge/embeddings/stats"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/embeddings/stats");
      if (!res.ok) throw new Error("Failed to fetch embedding stats");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const catalogStats = useMemo(() => {
    const uniqueProducts = new Set(catalogProducts.map(p => p.produto));
    const uniqueSubproducts = catalogProducts.filter(p => p.subproduto).length;
    return {
      productsCount: uniqueProducts.size,
      subproductsCount: uniqueSubproducts,
      subjectsCount: subjects.length,
      intentsCount: intents.length,
      articlesCount: articles.length,
      embeddingsCount: embeddingStats?.withEmbedding ?? 0,
    };
  }, [catalogProducts, subjects, intents, articles, embeddingStats]);

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
  };
}
