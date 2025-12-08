import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductLevelType } from "../../../lib/productHierarchy";

export interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
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
}

interface Filters {
  products: string[];
  intents: string[];
}

export interface CatalogProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
}

export interface HierarchyNode {
  name: string;
  level: ProductLevelType;
  fullPath: string;
  children: HierarchyNode[];
  articles: KnowledgeBaseArticle[];
}

function buildHierarchy(products: CatalogProduct[], articles: KnowledgeBaseArticle[]): HierarchyNode[] {
  const productNodes = new Map<string, HierarchyNode>();
  
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
    
    const prodNode = productNodes.get(product.produto)!;
    
    if (product.subproduto) {
      let subNode = prodNode.children.find(c => c.name === product.subproduto);
      if (!subNode) {
        subNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
        };
        prodNode.children.push(subNode);
      }
      
      if (product.categoria1) {
        let cat1Node = subNode.children.find(c => c.name === product.categoria1);
        if (!cat1Node) {
          cat1Node = {
            name: product.categoria1,
            level: "categoria1",
            fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1}`,
            children: [],
            articles: [],
          };
          subNode.children.push(cat1Node);
        }
        
        if (product.categoria2) {
          let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
          if (!cat2Node) {
            cat2Node = {
              name: product.categoria2,
              level: "categoria2",
              fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1} > ${product.categoria2}`,
              children: [],
              articles: [],
            };
            cat1Node.children.push(cat2Node);
          }
        }
      }
    }
  }
  
  for (const article of articles) {
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
      continue;
    }
    
    if (article.subproductStandard) {
      const subNode = prodNode.children.find(c => c.name === article.subproductStandard);
      if (subNode) {
        if (article.category1) {
          const cat1Node = subNode.children.find(c => c.name === article.category1);
          if (cat1Node) {
            if (article.category2) {
              const cat2Node = cat1Node.children.find(c => c.name === article.category2);
              if (cat2Node) {
                cat2Node.articles.push(article);
              } else {
                cat1Node.articles.push(article);
              }
            } else {
              cat1Node.articles.push(article);
            }
          } else {
            subNode.articles.push(article);
          }
        } else {
          subNode.articles.push(article);
        }
      } else {
        prodNode.articles.push(article);
      }
    } else {
      prodNode.articles.push(article);
    }
  }
  
  return Array.from(productNodes.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useKnowledgeBase(activeTab: string) {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIntent, setSelectedIntent] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading } = useQuery<KnowledgeBaseArticle[]>({
    queryKey: ["/api/knowledge-base", searchTerm, selectedProduct, selectedIntent],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedProduct) params.set("productStandard", selectedProduct);
      if (selectedIntent) params.set("intent", selectedIntent);
      const res = await fetch(`/api/knowledge-base?${params}`);
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

  const { data: filters } = useQuery<Filters>({
    queryKey: ["/api/knowledge-base/filters"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-base/filters");
      if (!res.ok) throw new Error("Failed to fetch filters");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const hierarchy = useMemo(() => buildHierarchy(catalogProducts, articles), [catalogProducts, articles]);

  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeBaseFormData) => {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: KnowledgeBaseFormData & { id: number }) => {
      const res = await fetch(`/api/knowledge-base/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setEditingArticle(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
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
    setSelectedProduct,
    selectedIntent,
    setSelectedIntent,
    expandedPaths,
    createMutation,
    updateMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancel,
    togglePath,
  };
}
