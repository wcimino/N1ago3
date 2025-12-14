import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { KnowledgeBaseArticle } from "./useKnowledgeQueries";

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

interface UseKnowledgeMutationsOptions {
  onCreateSuccess?: () => void;
  onUpdateSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

export function useKnowledgeMutations(options: UseKnowledgeMutationsOptions = {}) {
  const queryClient = useQueryClient();

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
      options.onCreateSuccess?.();
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
      options.onUpdateSuccess?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/articles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
      options.onDeleteSuccess?.();
    },
  });

  const generateEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/knowledge/embeddings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, includeOutdated: true }),
      });
      if (!res.ok) throw new Error("Failed to generate embeddings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/embeddings/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const handleSubmit = (
    data: KnowledgeBaseFormData,
    editingArticle: KnowledgeBaseArticle | null
  ) => {
    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este artigo?")) {
      deleteMutation.mutate(id);
    }
  };

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    generateEmbeddingsMutation,
    handleSubmit,
    handleDelete,
  };
}
