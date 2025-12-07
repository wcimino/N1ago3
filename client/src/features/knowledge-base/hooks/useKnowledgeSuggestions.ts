import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

export interface KnowledgeSuggestion {
  id: number;
  conversationId: number | null;
  externalConversationId: string | null;
  suggestionType: "create" | "update";
  productStandard: string | null;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  description: string | null;
  resolution: string | null;
  observations: string | null;
  confidenceScore: number | null;
  qualityFlags: {
    isComplete?: boolean;
    isUncertain?: boolean;
    possibleError?: boolean;
    needsReview?: boolean;
  } | null;
  similarArticleId: number | null;
  similarityScore: number | null;
  updateReason: string | null;
  status: "pending" | "approved" | "rejected" | "merged";
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  conversationHandler: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionStats {
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
}

export function useKnowledgeSuggestions(status?: string) {
  const queryClient = useQueryClient();

  const suggestionsQuery = useQuery<KnowledgeSuggestion[]>({
    queryKey: ["knowledge-suggestions", status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const url = `/api/knowledge-suggestions${params.toString() ? `?${params.toString()}` : ""}`;
      return fetchApi<KnowledgeSuggestion[]>(url);
    },
  });

  const statsQuery = useQuery<SuggestionStats>({
    queryKey: ["knowledge-suggestions-stats"],
    queryFn: () => fetchApi<SuggestionStats>("/api/knowledge-suggestions/stats"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/knowledge-suggestions/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions-stats"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => 
      apiRequest("POST", `/api/knowledge-suggestions/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions-stats"] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ id, targetArticleId }: { id: number; targetArticleId: number }) => 
      apiRequest("POST", `/api/knowledge-suggestions/${id}/merge`, { targetArticleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions-stats"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<KnowledgeSuggestion> }) => 
      apiRequest("PUT", `/api/knowledge-suggestions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
    },
  });

  return {
    suggestions: suggestionsQuery.data || [],
    stats: statsQuery.data,
    isLoading: suggestionsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    merge: mergeMutation.mutate,
    update: updateMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isMerging: mergeMutation.isPending,
  };
}
