import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Loader2, GitBranch, Check, AlertCircle, Puzzle } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";

interface KnowledgeBaseObjectiveProblem {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

interface KnowledgeBaseSolution {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface KnowledgeBaseRootCause {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  observedRate30d: string | null;
  observedN30d: string | null;
  observedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RootCauseWithRelations extends KnowledgeBaseRootCause {
  problems: KnowledgeBaseObjectiveProblem[];
  solutions: KnowledgeBaseSolution[];
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
  problemIds: number[];
  solutionIds: number[];
}

const emptyForm: FormData = {
  name: "",
  description: "",
  isActive: true,
  problemIds: [],
  solutionIds: [],
};

export function RootCausesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: rootCauses = [], isLoading } = useQuery<KnowledgeBaseRootCause[]>({
    queryKey: ["/api/knowledge/root-causes", searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      const res = await fetch(`/api/knowledge/root-causes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch root causes");
      return res.json();
    },
  });

  const { data: allProblems = [] } = useQuery<KnowledgeBaseObjectiveProblem[]>({
    queryKey: ["/api/knowledge/objective-problems"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/objective-problems");
      if (!res.ok) throw new Error("Failed to fetch problems");
      return res.json();
    },
  });

  const { data: allSolutions = [] } = useQuery<KnowledgeBaseSolution[]>({
    queryKey: ["/api/knowledge/solutions"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/solutions");
      if (!res.ok) throw new Error("Failed to fetch solutions");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/knowledge/root-causes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create root cause");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/root-causes"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const res = await fetch(`/api/knowledge/root-causes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update root cause");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/root-causes"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/root-causes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete root cause");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/root-causes"] });
    },
  });

  const stats = useMemo(() => {
    const total = rootCauses.length;
    const active = rootCauses.filter(r => r.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rootCauses]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = async (rootCause: KnowledgeBaseRootCause) => {
    try {
      const res = await fetch(`/api/knowledge/root-causes/${rootCause.id}?withRelations=true`);
      if (res.ok) {
        const data: RootCauseWithRelations = await res.json();
        setFormData({
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          problemIds: data.problems.map(p => p.id),
          solutionIds: data.solutions.map(s => s.id),
        });
      } else {
        setFormData({
          name: rootCause.name,
          description: rootCause.description,
          isActive: rootCause.isActive,
          problemIds: [],
          solutionIds: [],
        });
      }
    } catch {
      setFormData({
        name: rootCause.name,
        description: rootCause.description,
        isActive: rootCause.isActive,
        problemIds: [],
        solutionIds: [],
      });
    }
    setEditingId(rootCause.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta causa-raiz?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleProblem = (problemId: number) => {
    if (formData.problemIds.includes(problemId)) {
      setFormData({
        ...formData,
        problemIds: formData.problemIds.filter(id => id !== problemId),
      });
    } else {
      setFormData({
        ...formData,
        problemIds: [...formData.problemIds, problemId],
      });
    }
  };

  const toggleSolution = (solutionId: number) => {
    if (formData.solutionIds.includes(solutionId)) {
      setFormData({
        ...formData,
        solutionIds: formData.solutionIds.filter(id => id !== solutionId),
      });
    } else {
      setFormData({
        ...formData,
        solutionIds: [...formData.solutionIds, solutionId],
      });
    }
  };

  const activeProblems = allProblems.filter(p => p.isActive);
  const activeSolutions = allSolutions.filter(s => s.isActive);

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
        <FilterBar
          filters={[
            {
              type: "search",
              value: searchTerm,
              onChange: setSearchTerm,
              placeholder: "Buscar...",
            },
          ]}
        />
        <button
          onClick={() => {
            setFormData(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Causa-raiz
        </button>
      </div>

      <div className="text-sm text-gray-500 flex gap-4">
        <span>{stats.total} Causas-raízes</span>
        <span className="text-green-600">{stats.active} Ativas</span>
        <span className="text-gray-400">{stats.inactive} Inativas</span>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Causa-raiz" : "Nova Causa-raiz"}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Nome da causa-raiz..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Descrição detalhada da causa-raiz..."
                rows={3}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Problemas Relacionados ({formData.problemIds.length})
                </label>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {activeProblems.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Nenhum problema disponível
                    </div>
                  ) : (
                    activeProblems.map(problem => (
                      <label
                        key={problem.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.problemIds.includes(problem.id)}
                          onChange={() => toggleProblem(problem.id)}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 truncate">{problem.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Puzzle className="w-4 h-4 inline mr-1" />
                  Soluções Relacionadas ({formData.solutionIds.length})
                </label>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {activeSolutions.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Nenhuma solução disponível
                    </div>
                  ) : (
                    activeSolutions.map(solution => (
                      <label
                        key={solution.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.solutionIds.includes(solution.id)}
                          onChange={() => toggleSolution(solution.id)}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 truncate">{solution.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingId ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {rootCauses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma causa-raiz cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova Causa-raiz" para adicionar</p>
          </div>
        ) : (
          rootCauses.map(rootCause => (
            <div
              key={rootCause.id}
              className={`border rounded-lg p-4 ${rootCause.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <h4 className="font-medium text-gray-900 truncate">{rootCause.name}</h4>
                    {!rootCause.isActive && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{rootCause.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(rootCause)}
                    className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rootCause.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
