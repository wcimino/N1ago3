import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../../lib/queryClient";
import type { RoutingRule } from "./types";

const QUERY_KEY = ["routing-rules"];

export function useRoutingRules() {
  const queryClient = useQueryClient();

  const query = useQuery<RoutingRule[]>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchApi<RoutingRule[]>("/api/routing/rules"),
  });

  const createRule = useMutation({
    mutationFn: async (data: { ruleType: string; target: string; allocateCount: number; authFilter?: string; matchText?: string }) => {
      const response = await fetch("/api/routing/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deactivateRule = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/routing/rules/${id}/deactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to deactivate rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/routing/rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const rules = query.data || [];
  const newConvRules = rules.filter(r => r.ruleType === "allocate_next_n");
  const ongoingConvRules = rules.filter(r => r.ruleType === "transfer_ongoing");

  return {
    rules,
    newConvRules,
    ongoingConvRules,
    isLoading: query.isLoading,
    createRule,
    deactivateRule,
    deleteRule,
  };
}
