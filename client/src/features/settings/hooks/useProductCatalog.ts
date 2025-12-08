import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { 
  ProductTreeNode, 
  ProductLevelType,
  buildProductTree,
  getNodeKey
} from "../../../lib/productHierarchy";
import { useTreeExpansion } from "../../../shared/components/ui";

interface IfoodProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductData {
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
}

export function useProductCatalog() {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expandedNodes, toggleNode, expandNode } = useTreeExpansion();
  const [addingTo, setAddingTo] = useState<{ parentNode: ProductTreeNode | null; level: ProductLevelType } | null>(null);
  const [editingNode, setEditingNode] = useState<ProductTreeNode | null>(null);

  const { data: products, isLoading } = useQuery<IfoodProduct[]>({
    queryKey: ["product-catalog"],
    queryFn: () => fetchApi<IfoodProduct[]>("/api/product-catalog"),
  });

  const tree = useMemo(() => buildProductTree(products || []), [products]);

  const createMutation = useMutation({
    mutationFn: async (data: ProductData) => {
      return apiRequest("POST", "/api/product-catalog", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["product-catalog-fullnames"] });
      setAddingTo(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao criar produto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/product-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["product-catalog-fullnames"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & ProductData) => {
      return apiRequest("PUT", `/api/product-catalog/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["product-catalog-fullnames"] });
      setEditingNode(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao atualizar produto");
    },
  });

  const handleAdd = (parentNode: ProductTreeNode, level: ProductLevelType) => {
    const nodeKey = getNodeKey(parentNode);
    expandNode(nodeKey);
    setAddingTo({ parentNode, level });
  };

  const handleAddSubmit = (name: string) => {
    if (!addingTo) return;

    const { parentNode, level } = addingTo;

    let data: ProductData;

    if (level === "produto") {
      data = { produto: name, subproduto: null, categoria1: null, categoria2: null };
    } else if (level === "subproduto") {
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: name, 
        categoria1: null, 
        categoria2: null 
      };
    } else if (level === "categoria1") {
      const subproduto = parentNode!.level === "subproduto" 
        ? parentNode!.name 
        : parentNode!.ancestry.subproduto;
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: subproduto,
        categoria1: name, 
        categoria2: null 
      };
    } else {
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: parentNode!.ancestry.subproduto,
        categoria1: parentNode!.level === "categoria1" ? parentNode!.name : parentNode!.ancestry.categoria1, 
        categoria2: name 
      };
    }

    createMutation.mutate(data);
  };

  const handleStartAddProduto = () => {
    setAddingTo({ parentNode: null, level: "produto" });
  };

  const handleEdit = (node: ProductTreeNode) => {
    setEditingNode(node);
    setAddingTo(null);
  };

  const handleEditSubmit = (newName: string) => {
    if (!editingNode || !editingNode.productId) return;

    const level = editingNode.level;
    let data: ProductData;

    if (level === "produto") {
      data = { produto: newName, subproduto: null, categoria1: null, categoria2: null };
    } else if (level === "subproduto") {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: newName, 
        categoria1: null, 
        categoria2: null 
      };
    } else if (level === "categoria1") {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: editingNode.ancestry.subproduto,
        categoria1: newName, 
        categoria2: null 
      };
    } else {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: editingNode.ancestry.subproduto,
        categoria1: editingNode.ancestry.categoria1, 
        categoria2: newName 
      };
    }

    updateMutation.mutate({ id: editingNode.productId, ...data });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleCancelAdd = () => {
    setAddingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingNode(null);
  };

  return {
    tree,
    isLoading,
    showSuccess,
    error,
    expandedNodes,
    toggleNode,
    addingTo,
    editingNode,
    createMutation,
    updateMutation,
    deleteMutation,
    handleAdd,
    handleAddSubmit,
    handleStartAddProduto,
    handleEdit,
    handleEditSubmit,
    handleDelete,
    handleCancelAdd,
    handleCancelEdit,
  };
}
