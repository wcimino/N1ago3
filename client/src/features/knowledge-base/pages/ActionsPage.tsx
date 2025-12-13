import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, Loader2, Play, MessageSquare } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";

interface ActionStats {
  total: number;
  active: number;
  inactive: number;
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
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  actionType: string;
  description: string;
  requiredInput: string;
  messageTemplate: string;
  ownerTeam: string;
  sla: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  actionType: "",
  description: "",
  requiredInput: "",
  messageTemplate: "",
  ownerTeam: "",
  sla: "",
  isActive: true,
};

const actionTypeOptions = [
  { value: "internal_action_human", label: "Ação interna manual" },
  { value: "escalate", label: "Escalar" },
  { value: "inform", label: "Informar" },
  { value: "other", label: "Outro" },
  { value: "ask-customer", label: "Perguntar ao cliente" },
  { value: "resolve", label: "Resolver" },
  { value: "transfer", label: "Transferir" },
];

export function ActionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading } = useQuery<KnowledgeBaseAction[]>({
    queryKey: ["/api/knowledge/actions"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/actions");
      if (!res.ok) throw new Error("Failed to fetch actions");
      return res.json();
    },
  });

  const { data: stats } = useQuery<ActionStats>({
    queryKey: ["/api/knowledge/actions/stats"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/actions/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/knowledge/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          requiredInput: data.requiredInput || null,
          messageTemplate: data.messageTemplate || null,
          ownerTeam: data.ownerTeam || null,
          sla: data.sla || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions/stats"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const res = await fetch(`/api/knowledge/actions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          requiredInput: data.requiredInput || null,
          messageTemplate: data.messageTemplate || null,
          ownerTeam: data.ownerTeam || null,
          sla: data.sla || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions/stats"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/actions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/actions/stats"] });
    },
  });

  const filteredActions = useMemo(() => {
    let result = actions;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.description.toLowerCase().includes(term) ||
        a.actionType.toLowerCase().includes(term) ||
        a.messageTemplate?.toLowerCase().includes(term)
      );
    }
    
    if (selectedActionType) {
      result = result.filter(a => a.actionType === selectedActionType);
    }
    
    return result;
  }, [actions, searchTerm, selectedActionType]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = (action: KnowledgeBaseAction) => {
    setFormData({
      actionType: action.actionType,
      description: action.description,
      requiredInput: action.requiredInput || "",
      messageTemplate: action.messageTemplate || "",
      ownerTeam: action.ownerTeam || "",
      sla: action.sla || "",
      isActive: action.isActive,
    });
    setEditingId(action.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta acao?")) {
      deleteMutation.mutate(id);
    }
  };

  const getActionTypeLabel = (type: string) => {
    return actionTypeOptions.find(o => o.value === type)?.label || type;
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
                placeholder: "Tipo",
                options: actionTypeOptions.map(o => ({ value: o.value, label: o.label })),
                value: selectedActionType,
                onChange: setSelectedActionType,
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
          Nova Acao
        </button>
      </div>

      <div className="text-sm text-gray-500 flex gap-4">
        <span>{stats?.total || 0} Acoes</span>
        <span className="text-green-600">{stats?.active || 0} Ativas</span>
        <span className="text-gray-400">{stats?.inactive || 0} Inativas</span>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Acao" : "Nova Acao"}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Acao *
                </label>
                <select
                  value={formData.actionType}
                  onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {actionTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
                Descricao *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Orientar alternativas quando o cliente nao esta logado..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template de Mensagem
              </label>
              <textarea
                value={formData.messageTemplate}
                onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                rows={4}
                placeholder="Sem acesso a area logada, da pra seguir de duas formas..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Obrigatorio
                </label>
                <input
                  type="text"
                  value={formData.requiredInput}
                  onChange={(e) => setFormData({ ...formData, requiredInput: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="email, cpf, etc..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Responsavel
                </label>
                <input
                  type="text"
                  value={formData.ownerTeam}
                  onChange={(e) => setFormData({ ...formData, ownerTeam: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="Suporte N2, Financeiro..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SLA
                </label>
                <input
                  type="text"
                  value={formData.sla}
                  onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="24h, 48h..."
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
                disabled={createMutation.isPending || updateMutation.isPending}
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
        {filteredActions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm || selectedActionType ? "Nenhuma acao encontrada com os filtros atuais" : "Nenhuma acao cadastrada"}
          </div>
        ) : (
          filteredActions.map((action) => (
            <div
              key={action.id}
              className={`bg-white border rounded-lg p-4 ${
                action.isActive ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-800">
                      <Play className="w-3 h-3" />
                      {getActionTypeLabel(action.actionType)}
                    </span>
                    {!action.isActive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        Inativo
                      </span>
                    )}
                    {action.ownerTeam && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {action.ownerTeam}
                      </span>
                    )}
                    {action.sla && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        SLA: {action.sla}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-900 font-medium">{action.description}</p>
                  
                  {action.messageTemplate && (
                    <div className="flex items-start gap-2 mt-2 p-3 bg-gray-50 rounded-lg">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{action.messageTemplate}</p>
                    </div>
                  )}
                  
                  {action.requiredInput && (
                    <p className="text-xs text-gray-500">
                      Input obrigatorio: <span className="font-medium">{action.requiredInput}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleEdit(action)}
                    className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(action.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                    disabled={deleteMutation.isPending}
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
