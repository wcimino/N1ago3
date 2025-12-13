import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, Loader2, Puzzle, ChevronDown, ChevronUp, Play, ArrowUp, ArrowDown } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";

interface KnowledgeBaseSolution {
  id: number;
  name: string;
  description: string | null;
  product: string | null;
  subject: string | null;
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
  products: string[];
  subjects: string[];
}

interface FormData {
  name: string;
  description: string;
  product: string;
  subject: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  name: "",
  description: "",
  product: "",
  subject: "",
  isActive: true,
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

export function SolutionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [expandedSolutionId, setExpandedSolutionId] = useState<number | null>(null);
  const [showActionSelector, setShowActionSelector] = useState(false);
  const queryClient = useQueryClient();

  const invalidateAllSolutions = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions"] });
  };

  const { data: solutions = [], isLoading } = useQuery<KnowledgeBaseSolution[]>({
    queryKey: ["/api/knowledge/solutions", searchTerm, selectedProduct, selectedSubject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (selectedProduct) params.append("product", selectedProduct);
      if (selectedSubject) params.append("subject", selectedSubject);
      const res = await fetch(`/api/knowledge/solutions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch solutions");
      return res.json();
    },
  });

  const { data: filters } = useQuery<SolutionFilters>({
    queryKey: ["/api/knowledge/solutions/filters"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/solutions/filters");
      if (!res.ok) throw new Error("Failed to fetch filters");
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
      const res = await fetch("/api/knowledge/solutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          description: data.description || null,
          product: data.product || null,
          subject: data.subject || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create solution");
      return res.json();
    },
    onSuccess: () => {
      invalidateAllSolutions();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions/filters"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const res = await fetch(`/api/knowledge/solutions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          description: data.description || null,
          product: data.product || null,
          subject: data.subject || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update solution");
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateAllSolutions();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions/filters"] });
      if (expandedSolutionId === variables.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/solutions", variables.id, "withActions"] });
      }
      resetForm();
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
  };

  const handleEdit = (solution: KnowledgeBaseSolution) => {
    setFormData({
      name: solution.name,
      description: solution.description || "",
      product: solution.product || "",
      subject: solution.subject || "",
      isActive: solution.isActive,
    });
    setEditingId(solution.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
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
                options: (filters?.products || []).map(p => ({ value: p, label: p })),
                value: selectedProduct,
                onChange: setSelectedProduct,
              },
              {
                type: "select",
                placeholder: "Assunto",
                options: (filters?.subjects || []).map(s => ({ value: s, label: s })),
                value: selectedSubject,
                onChange: setSelectedSubject,
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produto
                </label>
                <input
                  type="text"
                  value={formData.product}
                  onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="Nome do produto..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="Assunto relacionado..."
                />
              </div>
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
        </div>
      )}

      <div className="space-y-2">
        {solutions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm || selectedProduct || selectedSubject 
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
                    {solution.product && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                        {solution.product}
                      </span>
                    )}
                    {solution.subject && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex-shrink-0">
                        {solution.subject}
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
