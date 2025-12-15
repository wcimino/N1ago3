import { useMutation, useQueryClient } from "@tanstack/react-query";

interface InputModalState {
  isOpen: boolean;
  type: "subject" | "intent" | null;
  targetId: number | null;
  mode: "create" | "edit";
  currentName?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  type: "subject" | "intent" | null;
  id: number | null;
  name: string;
  hasArticles: boolean;
}

export function useSubjectIntentMutations() {
  const queryClient = useQueryClient();

  const createSubjectMutation = useMutation({
    mutationFn: async (data: { productCatalogId: number; name: string }) => {
      const res = await fetch("/api/knowledge/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
    },
  });

  const createIntentMutation = useMutation({
    mutationFn: async (data: { subjectId: number; name: string }) => {
      const res = await fetch("/api/knowledge/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create intent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/subjects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete subject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const deleteIntentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/intents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete intent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const updateIntentMutation = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/intents/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) throw new Error("Failed to update intent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/subjects/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
    },
  });

  const handleInputModalConfirm = (inputModal: InputModalState, name: string) => {
    if (inputModal.mode === "edit" && inputModal.type === "subject" && inputModal.targetId) {
      updateSubjectMutation.mutate({ id: inputModal.targetId, name });
    } else if (inputModal.mode === "edit" && inputModal.type === "intent" && inputModal.targetId) {
      updateIntentMutation.mutate({ id: inputModal.targetId, name });
    } else if (inputModal.type === "subject" && inputModal.targetId) {
      createSubjectMutation.mutate({ productCatalogId: inputModal.targetId, name });
    } else if (inputModal.type === "intent" && inputModal.targetId) {
      createIntentMutation.mutate({ subjectId: inputModal.targetId, name });
    }
  };

  const handleConfirmDelete = (confirmModal: ConfirmModalState) => {
    if (confirmModal.type === "subject" && confirmModal.id) {
      deleteSubjectMutation.mutate(confirmModal.id);
    } else if (confirmModal.type === "intent" && confirmModal.id) {
      deleteIntentMutation.mutate(confirmModal.id);
    }
  };

  return {
    createSubjectMutation,
    createIntentMutation,
    deleteSubjectMutation,
    deleteIntentMutation,
    updateIntentMutation,
    updateSubjectMutation,
    handleInputModalConfirm,
    handleConfirmDelete,
  };
}

export type { InputModalState, ConfirmModalState };
