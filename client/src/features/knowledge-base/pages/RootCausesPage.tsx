import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, GitBranch } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { useCrudMutations, useCrudFormState } from "../../../shared/hooks";
import { 
  RootCauseForm, 
  emptyRootCauseForm,
  type RootCauseFormData 
} from "../components/RootCauseForm";

interface ValidationQuestion {
  question: string;
  order: number;
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

export function RootCausesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const {
    showForm,
    editingId,
    formData,
    setFormData,
    openCreateForm,
    openEditForm,
    resetForm,
    isEditing,
  } = useCrudFormState<RootCauseFormData>({
    emptyForm: emptyRootCauseForm,
  });

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

  const { handleCreate, handleUpdate, handleDelete, isMutating, isDeleting } = useCrudMutations<RootCauseFormData, RootCauseFormData>({
    baseUrl: "/api/knowledge/root-causes",
    queryKeys: ["/api/knowledge/root-causes"],
    onCreateSuccess: resetForm,
    onUpdateSuccess: resetForm,
  });

  const stats = useMemo(() => {
    const total = rootCauses.length;
    const active = rootCauses.filter(r => r.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rootCauses]);

  const handleEdit = async (rootCause: KnowledgeBaseRootCause) => {
    try {
      const res = await fetch(`/api/knowledge/root-causes/${rootCause.id}?withRelations=true`);
      if (res.ok) {
        const data = await res.json();
        openEditForm(rootCause.id, {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          problems: data.problems.map((p: { id: number; validationQuestions: ValidationQuestion[] }) => ({
            problemId: p.id,
            validationQuestions: p.validationQuestions || [],
          })),
          solutionIds: data.solutions.map((s: { id: number }) => s.id),
        });
      } else {
        openEditForm(rootCause.id, {
          name: rootCause.name,
          description: rootCause.description,
          isActive: rootCause.isActive,
          problems: [],
          solutionIds: [],
        });
      }
    } catch {
      openEditForm(rootCause.id, {
        name: rootCause.name,
        description: rootCause.description,
        isActive: rootCause.isActive,
        problems: [],
        solutionIds: [],
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) return;

    if (editingId) {
      handleUpdate(editingId, formData);
    } else {
      handleCreate(formData);
    }
  };

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
          onClick={openCreateForm}
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
        <RootCauseForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={resetForm}
          isEditing={isEditing}
          isMutating={isMutating}
        />
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
                    onClick={() => handleDelete(rootCause.id, "Tem certeza que deseja excluir esta causa-raiz?")}
                    disabled={isDeleting}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
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
