import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SolutionWithActions, KnowledgeBaseAction } from "../../../types";

interface UseSolutionActionsOptions {
  solutionId: number | null;
}

export function useSolutionActions({ solutionId }: UseSolutionActionsOptions) {
  const queryClient = useQueryClient();

  const { data: solutionWithActions } = useQuery<SolutionWithActions>({
    queryKey: ["/api/knowledge/solutions", solutionId, "withActions"],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge/solutions/${solutionId}?withActions=true`);
      if (!res.ok) throw new Error("Failed to fetch solution with actions");
      return res.json();
    },
    enabled: !!solutionId,
  });

  const { data: allActions = [] } = useQuery<KnowledgeBaseAction[]>({
    queryKey: ["/api/knowledge/actions"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/actions");
      if (!res.ok) throw new Error("Failed to fetch actions");
      return res.json();
    },
  });

  const addActionMutation = useMutation({
    mutationFn: async ({ actionId, actionSequence }: { actionId: number; actionSequence: number }) => {
      if (!solutionId) throw new Error("No solution selected");
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, actionSequence }),
      });
      if (!res.ok) throw new Error("Failed to add action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", solutionId, "withActions"] });
    },
  });

  const removeActionMutation = useMutation({
    mutationFn: async (actionId: number) => {
      if (!solutionId) throw new Error("No solution selected");
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions/${actionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", solutionId, "withActions"] });
    },
  });

  const reorderActionsMutation = useMutation({
    mutationFn: async (actionIds: number[]) => {
      if (!solutionId) throw new Error("No solution selected");
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder actions");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", solutionId, "withActions"] });
    },
  });

  const syncActions = async (selectedActionIds: number[]) => {
    if (!solutionId) throw new Error("No solution selected");
    
    const res = await fetch(`/api/knowledge/solutions/${solutionId}?withActions=true`);
    if (!res.ok) throw new Error("Failed to fetch current actions");
    const currentSolution: SolutionWithActions = await res.json();
    const currentActionIds = currentSolution.actions.map(a => a.id);

    const toRemove = currentActionIds.filter(id => !selectedActionIds.includes(id));
    const toAdd = selectedActionIds.filter(id => !currentActionIds.includes(id));

    for (const actionId of toRemove) {
      await removeActionMutation.mutateAsync(actionId);
    }

    for (let i = 0; i < toAdd.length; i++) {
      const actionId = toAdd[i];
      const sequence = currentActionIds.length - toRemove.length + i + 1;
      await addActionMutation.mutateAsync({ actionId, actionSequence: sequence });
    }

    if (toRemove.length === 0 && toAdd.length === 0 && selectedActionIds.length > 0) {
      const needsReorder = !selectedActionIds.every((id, idx) => currentActionIds[idx] === id);
      if (needsReorder) {
        await reorderActionsMutation.mutateAsync(selectedActionIds);
      }
    }
  };

  return {
    solutionWithActions,
    allActions,
    addAction: addActionMutation.mutate,
    removeAction: removeActionMutation.mutate,
    reorderActions: reorderActionsMutation.mutate,
    syncActions,
    isAddingAction: addActionMutation.isPending,
    isRemovingAction: removeActionMutation.isPending,
    isReordering: reorderActionsMutation.isPending,
  };
}
