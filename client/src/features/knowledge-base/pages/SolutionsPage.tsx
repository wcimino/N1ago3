import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, Loader2, Puzzle, ChevronDown, ChevronUp, Play, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { FormField } from "../../../shared/components/crud";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProductCatalog {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

interface KnowledgeBaseSolution {
  id: number;
  name: string;
  description: string | null;
  productId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseAction {
  id: number;
  actionType: string;
  description: string;
  requiredInput: string | null;
  messageTemplate: string | null;
  ownerTeam: string | null;
  sla: string | null;
  isActive: boolean;
  actionSequence: number;
}

interface SolutionWithActions extends KnowledgeBaseSolution {
  actions: KnowledgeBaseAction[];
}

interface SolutionFilters {
  productIds: number[];
}

interface FormData {
  name: string;
  description: string;
  productId: number | null;
  isActive: boolean;
  selectedActionIds: number[];
}

const emptyForm: FormData = {
  name: "",
  description: "",
  productId: null,
  isActive: true,
  selectedActionIds: [],
};

const actionTypeLabels: Record<string, string> = {
  "internal_action_human": "Ação interna manual",
  "escalate": "Escalar",
  "inform": "Informar",
  "other": "Outro",
  "ask-customer": "Perguntar ao cliente",
  "resolve": "Resolver",
  "transfer": "Transferir",
};

interface SortableActionItemProps {
  action: KnowledgeBaseAction;
  index: number;
  onRemove: (id: number) => void;
  getActionTypeLabel: (type: string) => string;
}

function SortableActionItem({ action, index, onRemove, getActionTypeLabel }: SortableActionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
    >
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-violet-100 text-violet-700 rounded-full flex-shrink-0">
        {index + 1}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 flex-shrink-0">
        <Play className="w-3 h-3" />
        {getActionTypeLabel(action.actionType)}
      </span>
      <span className="flex-1 text-sm text-gray-900 truncate">{action.description}</span>
      <button
        type="button"
        onClick={() => onRemove(action.id)}
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        title="Remover ação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function SolutionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [expandedSolutionId, setExpandedSolutionId] = useState<number | null>(null);
  const [showActionSelector, setShowActionSelector] = useState(false);
  const [editingOriginalActionIds, setEditingOriginalActionIds] = useState<number[]>([]);
  const [showFormActionModal, setShowFormActionModal] = useState(false);
  const [pendingActionIds, setPendingActionIds] = useState<number[]>([]);
  const [formSelectedProduto, setFormSelectedProduto] = useState<string>("");
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const invalidateAllSolutions = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions"] });
  };

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

  const { data: productCatalog = [] } = useQuery<ProductCatalog[]>({
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

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { selectedActionIds, ...solutionData } = data;
      const res = await fetch("/api/knowledge/solutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: solutionData.name,
          description: solutionData.description || null,
          productId: solutionData.productId,
          isActive: solutionData.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to create solution");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const { selectedActionIds, ...solutionData } = data;
      const res = await fetch(`/api/knowledge/solutions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: solutionData.name,
          description: solutionData.description || null,
          productId: solutionData.productId,
          isActive: solutionData.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to update solution");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/solutions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete solution");
    },
    onSuccess: (_, deletedId) => {
      invalidateAllSolutions();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions/filters"] });
      if (expandedSolutionId === deletedId) {
        setExpandedSolutionId(null);
      }
    },
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
      const res = await fetch(`/api/knowledge/solutions/${solutionId}/actions/${actionId}`, {
        method: "DELETE",
      });
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

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setEditingOriginalActionIds([]);
    setFormSelectedProduto("");
  };

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
    
    setEditingOriginalActionIds(actionIds);
    setFormData({
      name: solution.name,
      description: solution.description || "",
      productId: solution.productId,
      isActive: solution.isActive,
      selectedActionIds: actionIds,
    });
    const product = productCatalog.find(p => p.id === solution.productId);
    setFormSelectedProduto(product?.produto || "");
    setEditingId(solution.id);
    setShowForm(true);
  };

  const syncSolutionActions = async (solutionId: number, selectedActionIds: number[], originalActionIds: number[]) => {
    const toRemove = originalActionIds.filter(id => !selectedActionIds.includes(id));
    const toAdd = selectedActionIds.filter(id => !originalActionIds.includes(id));
    
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
    if (!formData.name.trim()) return;
    
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: formData });
        await syncSolutionActions(editingId, formData.selectedActionIds, editingOriginalActionIds);
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", editingId, "withActions"] });
      } else {
        const newSolution = await createMutation.mutateAsync(formData);
        if (formData.selectedActionIds.length > 0) {
          for (let i = 0; i < formData.selectedActionIds.length; i++) {
            const actionId = formData.selectedActionIds[i];
            await fetch(`/api/knowledge/solutions/${newSolution.id}/actions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ actionId, actionSequence: i + 1 }),
            });
          }
        }
      }
      invalidateAllSolutions();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions/filters"] });
      resetForm();
    } catch (error) {
      console.error("Failed to save solution", error);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta solução?")) {
      deleteMutation.mutate(id);
    }
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

  const uniqueProdutos = useMemo(() => {
    const produtos = new Set<string>();
    productCatalog.forEach((product) => produtos.add(product.produto));
    return Array.from(produtos).sort((a, b) => a.localeCompare(b));
  }, [productCatalog]);

  const subproductsForSelectedProduto = useMemo(() => {
    if (!formSelectedProduto) return [];
    return productCatalog
      .filter(p => p.produto === formSelectedProduto)
      .sort((a, b) => {
        if (!a.subproduto && !b.subproduto) return 0;
        if (!a.subproduto) return -1;
        if (!b.subproduto) return 1;
        return a.subproduto.localeCompare(b.subproduto);
      });
  }, [productCatalog, formSelectedProduto]);

  const formSelectedActions = useMemo(() => {
    const actionMap = new Map(allActions.map(a => [a.id, a]));
    return formData.selectedActionIds
      .map(id => actionMap.get(id))
      .filter((a): a is KnowledgeBaseAction => a !== undefined);
  }, [allActions, formData.selectedActionIds]);

  const formAvailableActions = useMemo(() => {
    const selectedIds = new Set(formData.selectedActionIds);
    return allActions.filter(a => a.isActive && !selectedIds.has(a.id));
  }, [allActions, formData.selectedActionIds]);

  const handleFormDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = formData.selectedActionIds.indexOf(Number(active.id));
      const newIndex = formData.selectedActionIds.indexOf(Number(over.id));
      setFormData({
        ...formData,
        selectedActionIds: arrayMove(formData.selectedActionIds, oldIndex, newIndex),
      });
    }
  };

  const handleFormRemoveAction = (actionId: number) => {
    setFormData({
      ...formData,
      selectedActionIds: formData.selectedActionIds.filter(id => id !== actionId),
    });
  };

  const handleOpenActionModal = () => {
    setPendingActionIds([]);
    setShowFormActionModal(true);
  };

  const handleTogglePendingAction = (actionId: number) => {
    if (pendingActionIds.includes(actionId)) {
      setPendingActionIds(pendingActionIds.filter(id => id !== actionId));
    } else {
      setPendingActionIds([...pendingActionIds, actionId]);
    }
  };

  const handleConfirmAddActions = () => {
    setFormData({
      ...formData,
      selectedActionIds: [...formData.selectedActionIds, ...pendingActionIds],
    });
    setShowFormActionModal(false);
    setPendingActionIds([]);
  };

  const getActionTypeLabel = (type: string) => actionTypeLabels[type] || type;

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
          onClick={() => {
            setFormData(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
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

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Solução" : "Nova Solução"}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produto
                </label>
                <select
                  value={formSelectedProduto}
                  onChange={(e) => {
                    setFormSelectedProduto(e.target.value);
                    setFormData({ ...formData, productId: null });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
                >
                  <option value="">Selecione um produto...</option>
                  {uniqueProdutos.map((produto) => (
                    <option key={produto} value={produto}>{produto}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subproduto
                </label>
                <select
                  value={formData.productId === null ? "" : String(formData.productId)}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    productId: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  disabled={!formSelectedProduto}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione...</option>
                  {subproductsForSelectedProduto.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.subproduto || "(Geral)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="Nome da solução..."
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Ativo
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                rows={3}
                placeholder="Descreva a solução..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Ações
                </label>
                <button
                  type="button"
                  onClick={handleOpenActionModal}
                  disabled={formAvailableActions.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar Ação
                </button>
              </div>

              <div className="border border-gray-300 rounded-lg p-3 min-h-[80px] bg-gray-50">
                {formSelectedActions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhuma ação selecionada. Clique em "Adicionar Ação" para incluir ações.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleFormDragEnd}
                  >
                    <SortableContext
                      items={formData.selectedActionIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {formSelectedActions.map((action, index) => (
                          <SortableActionItem
                            key={action.id}
                            action={action}
                            index={index}
                            onRemove={handleFormRemoveAction}
                            getActionTypeLabel={getActionTypeLabel}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
              {formData.selectedActionIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Arraste para reordenar. {formData.selectedActionIds.length} {formData.selectedActionIds.length === 1 ? "ação selecionada" : "ações selecionadas"}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || !formData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Check className="w-4 h-4" />
                {editingId ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>

          {showFormActionModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900">Selecionar Ações</h4>
                  <button
                    onClick={() => setShowFormActionModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {formAvailableActions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Todas as ações já foram adicionadas.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formAvailableActions.map((action) => {
                        const isChecked = pendingActionIds.includes(action.id);
                        return (
                          <label
                            key={action.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-violet-100 border border-violet-300"
                                : "bg-gray-50 border border-gray-200 hover:border-violet-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePendingAction(action.id)}
                              className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Play className="w-3 h-3 text-violet-600 flex-shrink-0" />
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  [{getActionTypeLabel(action.actionType)}]
                                </span>
                                <span className="text-sm text-gray-900 truncate">
                                  {action.description}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-sm text-gray-500">
                    {pendingActionIds.length} {pendingActionIds.length === 1 ? "ação selecionada" : "ações selecionadas"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFormActionModal(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAddActions}
                      disabled={pendingActionIds.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
                      disabled={deleteMutation.isPending}
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
