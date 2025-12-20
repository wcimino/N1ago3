import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchApi } from "../../../../lib/queryClient";
import type { ExternalEventSource, ExternalEventSourcesResponse } from "./types";
import { ROTATION_WARNING_DAYS } from "./types";

export function useExternalEventSources() {
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<Map<number, string>>(new Map());
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ExternalEventSourcesResponse>({
    queryKey: ["external-event-sources"],
    queryFn: () => fetchApi<ExternalEventSourcesResponse>("/api/external-event-sources"),
  });

  const sources = data?.sources || [];

  const addMutation = useMutation({
    mutationFn: async ({ name, source, channel_type }: { name: string; source: string; channel_type: string }) => {
      const res = await apiRequest("POST", "/api/external-event-sources", { name, source, channel_type });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      if (data.api_key) {
        setNewlyCreatedKeys((prev) => new Map(prev).set(data.id, data.api_key));
      }
      setAddError(null);
    },
    onError: (err: any) => {
      setAddError(err.message || "Erro ao adicionar sistema");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, channel_type }: { id: number; name: string; channel_type: string }) => {
      const res = await apiRequest("PUT", `/api/external-event-sources/${id}`, { name, channel_type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      setUpdateError(null);
    },
    onError: (err: any) => {
      setUpdateError(err.message || "Erro ao atualizar sistema");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const res = await apiRequest("PUT", `/api/external-event-sources/${id}`, { is_active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/external-event-sources/${id}/regenerate-key`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      if (data.api_key) {
        setNewlyCreatedKeys((prev) => new Map(prev).set(data.id, data.api_key));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/external-event-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
    },
  });

  const getDisplayApiKey = (source: ExternalEventSource): string => {
    const newKey = newlyCreatedKeys.get(source.id);
    if (newKey) return newKey;
    return source.api_key_masked || "****";
  };

  const hasNewKey = (id: number): boolean => {
    return newlyCreatedKeys.has(id);
  };

  const getNewKey = (id: number): string | undefined => {
    return newlyCreatedKeys.get(id);
  };

  const needsRotation = (source: ExternalEventSource): boolean => {
    const referenceDate = source.last_rotated_at || source.created_at;
    if (!referenceDate) return false;
    const date = new Date(referenceDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= ROTATION_WARNING_DAYS;
  };

  const getDaysSinceRotation = (source: ExternalEventSource): number => {
    const referenceDate = source.last_rotated_at || source.created_at;
    if (!referenceDate) return 0;
    const date = new Date(referenceDate);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  };

  const clearAddError = () => setAddError(null);
  const clearUpdateError = () => setUpdateError(null);

  return {
    sources,
    isLoading,
    newlyCreatedKeys,
    addMutation,
    updateMutation,
    toggleMutation,
    regenerateKeyMutation,
    deleteMutation,
    addError,
    updateError,
    clearAddError,
    clearUpdateError,
    getDisplayApiKey,
    hasNewKey,
    getNewKey,
    needsRotation,
    getDaysSinceRotation,
  };
}
