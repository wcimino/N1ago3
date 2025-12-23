import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { 
  ProductTreeNode, 
  ProductLevelType,
  ProductData,
  SubproductData,
  buildProductTree,
  getNodeKey
} from "../../../lib/productHierarchy";
import { useTreeExpansion } from "../../../shared/components/ui";

interface CreateProductData {
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface CreateSubproductData {
  name: string;
  produtoId: string;
}

export function useProductCatalog() {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expandedNodes, toggleNode, expandNode } = useTreeExpansion();
  const [addingTo, setAddingTo] = useState<{ parentNode: ProductTreeNode | null; level: ProductLevelType } | null>(null);
  const [editingNode, setEditingNode] = useState<ProductTreeNode | null>(null);

  const { data: products, isLoading: isLoadingProducts } = useQuery<ProductData[]>({
    queryKey: ["product-catalog"],
    queryFn: () => fetchApi<ProductData[]>("/api/product-catalog"),
  });

  const { data: subproducts, isLoading: isLoadingSubproducts } = useQuery<SubproductData[]>({
    queryKey: ["subproduct-catalog"],
    queryFn: () => fetchApi<SubproductData[]>("/api/subproduct-catalog"),
  });

  const isLoading = isLoadingProducts || isLoadingSubproducts;

  const tree = useMemo(() => 
    buildProductTree(products || [], subproducts || []), 
    [products, subproducts]
  );

  const createProductMutation = useMutation({
    mutationFn: async (data: CreateProductData) => {
      return apiRequest("POST", "/api/product-catalog", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      setAddingTo(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao criar produto");
    },
  });

  const createSubproductMutation = useMutation({
    mutationFn: async (data: CreateSubproductData) => {
      return apiRequest("POST", "/api/subproduct-catalog", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subproduct-catalog"] });
      setAddingTo(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao criar subproduto");
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/product-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["subproduct-catalog"] });
    },
  });

  const deleteSubproductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subproduct-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subproduct-catalog"] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & CreateProductData) => {
      return apiRequest("PUT", `/api/product-catalog/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      setEditingNode(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao atualizar produto");
    },
  });

  const updateSubproductMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; produtoId?: string }) => {
      return apiRequest("PUT", `/api/subproduct-catalog/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subproduct-catalog"] });
      setEditingNode(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao atualizar subproduto");
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

    if (level === "produto") {
      createProductMutation.mutate({ name });
    } else if (level === "subproduto" && parentNode) {
      createSubproductMutation.mutate({ 
        name, 
        produtoId: parentNode.externalId 
      });
    }
  };

  const handleStartAddProduto = () => {
    setAddingTo({ parentNode: null, level: "produto" });
  };

  const handleEdit = (node: ProductTreeNode) => {
    setEditingNode(node);
    setAddingTo(null);
  };

  const handleEditSubmit = (newName: string) => {
    if (!editingNode) return;

    if (editingNode.level === "produto") {
      updateProductMutation.mutate({ 
        id: editingNode.id, 
        name: newName,
        icon: editingNode.icon,
        color: editingNode.color
      });
    } else if (editingNode.level === "subproduto") {
      updateSubproductMutation.mutate({ 
        id: editingNode.id, 
        name: newName 
      });
    }
  };

  const handleDelete = (node: ProductTreeNode) => {
    if (node.level === "produto") {
      deleteProductMutation.mutate(node.id);
    } else {
      deleteSubproductMutation.mutate(node.id);
    }
  };

  const handleCancelAdd = () => {
    setAddingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingNode(null);
  };

  const createMutation = createProductMutation;
  const updateMutation = updateProductMutation;
  const deleteMutation = deleteProductMutation;

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
