import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Loader2, Puzzle, ChevronDown, ChevronUp, Play, ArrowUp, ArrowDown } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { useCrudFormState } from "../../../shared/hooks/useCrudFormState";
import { useCrudMutations } from "../../../shared/hooks/useCrudMutations";
import { SolutionForm, type SolutionFormData } from "../components/SolutionForm";
import type { ProductCatalogItem, KnowledgeBaseSolution, KnowledgeBaseAction, SolutionWithActions } from "../../../types";
import { ACTION_TYPE_LABELS } from "@shared/constants/actionTypes";

const emptyForm: SolutionFormData = {
  name: "",
  description: "",
  productId: null,
  isActive: true,
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
    }),
    transformUpdateData: (data) => ({
      name: data.name,
      description: data.description || null,
      productId: data.productId,
      isActive: data.isActive,
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
        const newSolution = await solutionCrud.createMutation.mutateAsync(formState.formData);
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
    solutionCrud.handleDelete(id, "Tem certeza que deseja excluir esta solução?");
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
            <div key={solution.id} className="bg-white border rounded-lg overflow-hidden">
              <div
                className={`px-4 py-2 ${
                  solution.isActive ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleExpand(solution.id)}
                      className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                    >
                      {expandedSolutionId === solution.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-800 flex-shrink-0">
                      <Puzzle className="w-3 h-3" />
                      Solução
                    </span>
                    <span className="text-sm text-gray-900 font-medium truncate">{solution.name}</span>
                    {solution.productId && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                        {productCatalog.find(p => p.id === solution.productId)?.fullName || "Produto"}
                      </span>
                    )}
                    {!solution.isActive && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                        Inativo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(solution)}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(solution.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                      disabled={solutionCrud.isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {solution.description && (
                  <p className="text-sm text-gray-500 mt-1 ml-8 truncate">{solution.description}</p>
                )}
              </div>

              {expandedSolutionId === solution.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Ações da Solução</h4>
                    <button
                      onClick={() => setShowActionSelector(!showActionSelector)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Ação
                    </button>
                  </div>

                  {showActionSelector && (
                    <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Selecione uma ação:</h5>
                      {availableActions.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhuma ação disponível para adicionar.</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {availableActions.map((action) => (
                            <button
                              key={action.id}
                              onClick={() => handleAddAction(action.id)}
                              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-violet-50 transition-colors flex items-center gap-2"
                              disabled={addActionMutation.isPending}
                            >
                              <Play className="w-3 h-3 text-violet-600" />
                              <span className="text-xs text-gray-500">[{getActionTypeLabel(action.actionType)}]</span>
                              <span>{action.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {expandedSolution?.actions && expandedSolution.actions.length > 0 ? (
                    <div className="space-y-2">
                      {expandedSolution.actions.map((action, index) => (
                        <div
                          key={action.id}
                          className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handleMoveAction(action.id, "up")}
                              disabled={index === 0 || reorderActionsMutation.isPending}
                              className="p-0.5 text-gray-400 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveAction(action.id, "down")}
                              disabled={index === expandedSolution.actions.length - 1 || reorderActionsMutation.isPending}
                              className="p-0.5 text-gray-400 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                            {index + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            <Play className="w-3 h-3" />
                            {getActionTypeLabel(action.actionType)}
                          </span>
                          <span className="flex-1 text-sm text-gray-900 truncate">{action.description}</span>
                          <button
                            onClick={() => handleRemoveAction(action.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remover ação"
                            disabled={removeActionMutation.isPending}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhuma ação associada a esta solução.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
