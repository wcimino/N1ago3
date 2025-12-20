import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { useCrudFormState } from "../../../shared/hooks/useCrudFormState";
import { useCrudMutations } from "../../../shared/hooks/useCrudMutations";
import { SolutionForm, type SolutionFormData, SolutionListItem } from "../components";
import type { ProductCatalogItem, KnowledgeBaseSolution, KnowledgeBaseAction, SolutionWithActions } from "../../../types";
import { ACTION_TYPE_LABELS } from "@shared/constants/actionTypes";

const emptyForm: SolutionFormData = {
  name: "",
  description: "",
  productId: null,
  isActive: true,
  isFallback: false,
  isArticleDefault: false,
  selectedActionIds: [],
};

export function SolutionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [expandedSolutionId, setExpandedSolutionId] = useState<number | null>(null);
  const [showActionSelector, setShowActionSelector] = useState(false);
  const queryClient = useQueryClient();

  const formState = useCrudFormState<SolutionFormData>({ emptyForm });

  const solutionCrud = useCrudMutations<SolutionFormData, SolutionFormData>({
    baseUrl: "/api/knowledge/solutions",
    queryKeys: ["/api/knowledge/solutions", "/api/knowledge/solutions/filters"],
    transformCreateData: (data) => ({
      name: data.name,
      description: data.description || null,
      productId: data.productId,
      isActive: data.isActive,
      isFallback: data.isFallback,
      isArticleDefault: data.isArticleDefault,
    }),
    transformUpdateData: (data) => ({
      name: data.name,
      description: data.description || null,
      productId: data.productId,
      isActive: data.isActive,
      isFallback: data.isFallback,
      isArticleDefault: data.isArticleDefault,
    }),
    onDeleteSuccess: (deletedId) => {
      if (expandedSolutionId === deletedId) {
        setExpandedSolutionId(null);
      }
    },
  });

  const { data: solutions = [], isLoading } = useQuery<KnowledgeBaseSolution[]>({
    queryKey: ["/api/knowledge/solutions", searchTerm, selectedProductId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (selectedProductId) params.append("productId", selectedProductId);
      const res = await fetch(`/api/knowledge/solutions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch solutions");
      return res.json();
    },
  });

  const { data: productCatalog = [] } = useQuery<ProductCatalogItem[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: allActions = [] } = useQuery<KnowledgeBaseAction[]>({
    queryKey: ["/api/knowledge/actions"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/actions");
      if (!res.ok) throw new Error("Failed to fetch actions");
      return res.json();
    },
  });

  const { data: expandedSolution } = useQuery<SolutionWithActions>({
    queryKey: ["/api/knowledge/solutions", expandedSolutionId, "withActions"],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge/solutions/${expandedSolutionId}?withActions=true`);
      if (!res.ok) throw new Error("Failed to fetch solution with actions");
      return res.json();
    },
    enabled: !!expandedSolutionId,
  });

  const addActionMutation = useMutation({
    mutationFn: async ({ solutionId, actionId, actionSequence }: { solutionId: number; actionId: number; actionSequence: number }) => {
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, actionSequence }),
      });
      if (!res.ok) throw new Error("Failed to add action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", expandedSolutionId, "withActions"] });
      setShowActionSelector(false);
    },
  });

  const removeActionMutation = useMutation({
    mutationFn: async ({ solutionId, actionId }: { solutionId: number; actionId: number }) => {
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions/${actionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", expandedSolutionId, "withActions"] });
    },
  });

  const reorderActionsMutation = useMutation({
    mutationFn: async ({ solutionId, actionIds }: { solutionId: number; actionIds: number[] }) => {
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder actions");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", expandedSolutionId, "withActions"] });
    },
  });

  const stats = useMemo(() => {
    const total = solutions.length;
    const active = solutions.filter(s => s.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [solutions]);

  const handleEdit = async (solution: KnowledgeBaseSolution) => {
    let actionIds: number[] = [];
    try {
      const res = await fetch(`/api/knowledge/solutions/${solution.id}?withActions=true`);
      if (res.ok) {
        const solutionWithActions: SolutionWithActions = await res.json();
        actionIds = solutionWithActions.actions.map(a => a.id);
      }
    } catch (e) {
      console.error("Failed to load solution actions", e);
    }
    
    formState.openEditForm(solution.id, {
      name: solution.name,
      description: solution.description || "",
      productId: solution.productId,
      isActive: solution.isActive,
      isFallback: solution.isFallback ?? false,
      isArticleDefault: solution.isArticleDefault ?? false,
      selectedActionIds: actionIds,
    });
  };

  const syncSolutionActions = async (solutionId: number, selectedActionIds: number[]) => {
    const res = await fetch(`/api/knowledge/solutions/${solutionId}?withActions=true`);
    if (!res.ok) throw new Error("Failed to fetch current actions");
    const solutionWithActions: SolutionWithActions = await res.json();
    const currentActionIds = solutionWithActions.actions.map(a => a.id);
    
    const toRemove = currentActionIds.filter(id => !selectedActionIds.includes(id));
    const toAdd = selectedActionIds.filter(id => !currentActionIds.includes(id));
    
    for (const actionId of toRemove) {
      await fetch(`/api/knowledge/solutions/${solutionId}/actions/${actionId}`, { method: "DELETE" });
    }
    
    for (const actionId of toAdd) {
      await fetch(`/api/knowledge/solutions/${solutionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, actionSequence: 999 }),
      });
    }
    
    if (selectedActionIds.length > 0) {
      await fetch(`/api/knowledge/solutions/${solutionId}/actions/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds: selectedActionIds }),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.formData.name.trim()) return;
    
    try {
      if (formState.editingId) {
        await solutionCrud.updateMutation.mutateAsync({ id: formState.editingId, data: formState.formData });
        await syncSolutionActions(formState.editingId, formState.formData.selectedActionIds);
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", formState.editingId, "withActions"] });
      } else {
        const newSolution = await solutionCrud.createMutation.mutateAsync(formState.formData) as { id: number };
        if (formState.formData.selectedActionIds.length > 0) {
          for (let i = 0; i < formState.formData.selectedActionIds.length; i++) {
            const actionId = formState.formData.selectedActionIds[i];
            await fetch(`/api/knowledge/solutions/${newSolution.id}/actions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ actionId, actionSequence: i + 1 }),
            });
          }
        }
      }
      formState.resetForm();
    } catch (error) {
      console.error("Failed to save solution", error);
    }
  };

  const handleDelete = (id: number) => {
    solutionCrud.handleDelete(id);
  };

  const handleToggleExpand = (id: number) => {
    setExpandedSolutionId(expandedSolutionId === id ? null : id);
    setShowActionSelector(false);
  };

  const handleAddAction = (actionId: number) => {
    if (!expandedSolutionId) return;
    const currentActions = expandedSolution?.actions || [];
    const nextSequence = currentActions.length + 1;
    addActionMutation.mutate({ solutionId: expandedSolutionId, actionId, actionSequence: nextSequence });
  };

  const handleRemoveAction = (actionId: number) => {
    if (!expandedSolutionId) return;
    removeActionMutation.mutate({ solutionId: expandedSolutionId, actionId });
  };

  const handleMoveAction = (actionId: number, direction: "up" | "down") => {
    if (!expandedSolutionId || !expandedSolution) return;
    
    const actions = [...expandedSolution.actions];
    const currentIndex = actions.findIndex(a => a.id === actionId);
    
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === actions.length - 1) return;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    [actions[currentIndex], actions[newIndex]] = [actions[newIndex], actions[currentIndex]];
    
    const newActionIds = actions.map(a => a.id);
    reorderActionsMutation.mutate({ solutionId: expandedSolutionId, actionIds: newActionIds });
  };

  const availableActions = useMemo(() => {
    if (!expandedSolution) return allActions.filter(a => a.isActive);
    const usedIds = new Set(expandedSolution.actions.map(a => a.id));
    return allActions.filter(a => a.isActive && !usedIds.has(a.id));
  }, [allActions, expandedSolution]);

  const getActionTypeLabel = (type: string) => ACTION_TYPE_LABELS[type] || type;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FilterBar
            filters={[
              {
                type: "search",
                value: searchTerm,
                onChange: setSearchTerm,
                placeholder: "Buscar...",
              },
              {
                type: "select",
                placeholder: "Produto",
                options: productCatalog.map(p => ({ value: String(p.id), label: p.fullName })),
                value: selectedProductId,
                onChange: setSelectedProductId,
              },
            ]}
          />
        </div>
        <button
          onClick={formState.openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Solução
        </button>
      </div>

      <div className="text-sm text-gray-500 flex gap-4">
        <span>{stats.total} Soluções</span>
        <span className="text-green-600">{stats.active} Ativas</span>
        <span className="text-gray-400">{stats.inactive} Inativas</span>
      </div>

      {formState.showForm && (
        <SolutionForm
          formData={formState.formData}
          setFormData={formState.setFormData}
          onSubmit={handleSubmit}
          onCancel={formState.resetForm}
          isSubmitting={solutionCrud.isMutating}
          isEditing={formState.isEditing}
          productCatalog={productCatalog}
          allActions={allActions}
        />
      )}

      <div className="space-y-2">
        {solutions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm || selectedProductId 
              ? "Nenhuma solução encontrada com os filtros atuais" 
              : "Nenhuma solução cadastrada"}
          </div>
        ) : (
          solutions.map((solution) => (
            <SolutionListItem
              key={solution.id}
              solution={solution}
              isExpanded={expandedSolutionId === solution.id}
              expandedSolution={expandedSolutionId === solution.id ? expandedSolution : undefined}
              productCatalog={productCatalog}
              availableActions={availableActions}
              showActionSelector={expandedSolutionId === solution.id && showActionSelector}
              isDeleting={solutionCrud.isDeleting}
              isAddingAction={addActionMutation.isPending}
              isRemovingAction={removeActionMutation.isPending}
              isReordering={reorderActionsMutation.isPending}
              onToggleExpand={() => handleToggleExpand(solution.id)}
              onEdit={() => handleEdit(solution)}
              onDelete={() => handleDelete(solution.id)}
              onToggleActionSelector={() => setShowActionSelector(!showActionSelector)}
              onAddAction={handleAddAction}
              onRemoveAction={handleRemoveAction}
              onMoveAction={handleMoveAction}
              getActionTypeLabel={getActionTypeLabel}
            />
          ))
        )}
      </div>
    </div>
  );
}
