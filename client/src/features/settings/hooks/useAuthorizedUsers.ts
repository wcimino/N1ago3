import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchApi } from "../../../lib/queryClient";
import type { AuthorizedUser } from "../../../types";

export function useAuthorizedUsers() {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: authorizedUsers, isLoading } = useQuery<AuthorizedUser[]>({
    queryKey: ["authorized-users"],
    queryFn: () => fetchApi<AuthorizedUser[]>("/api/authorized-users"),
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const res = await apiRequest("POST", "/api/authorized-users", { email, name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
      setNewEmail("");
      setNewName("");
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao adicionar usuário");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/authorized-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newEmail.toLowerCase().endsWith("@ifood.com.br")) {
      setError("Email deve ser do domínio @ifood.com.br");
      return;
    }

    addMutation.mutate({ email: newEmail, name: newName });
  };

  const handleRemove = (id: number) => {
    removeMutation.mutate(id);
  };

  return {
    authorizedUsers,
    isLoading,
    newEmail,
    setNewEmail,
    newName,
    setNewName,
    error,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    handleSubmit,
    handleRemove,
  };
}
