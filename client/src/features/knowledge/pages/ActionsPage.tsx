import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Loader2 } from "lucide-react";
import { CrudPageLayout, CrudListItem, FormField } from "../../../shared/components/crud";
import { useCrudMutations } from "../../../shared/hooks";
import type { KnowledgeBaseAction, ActionStats } from "../../../types";
import { ACTION_TYPE_OPTIONS, getActionTypeLabel } from "@shared/constants/actionTypes";

interface ActionFormData {
  actionType: string;
  description: string;
  requiredInput: string;
  messageTemplate: string;
  ownerTeam: string;
  sla: string;
  isActive: boolean;
}

const emptyForm: ActionFormData = {
  actionType: "",
  description: "",
  requiredInput: "",
  messageTemplate: "",
  ownerTeam: "",
  sla: "",
  isActive: true,
};

const transformFormData = (data: ActionFormData) => ({
  ...data,
  requiredInput: data.requiredInput || null,
  messageTemplate: data.messageTemplate || null,
  ownerTeam: data.ownerTeam || null,
  sla: data.sla || null,
});

export function ActionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ActionFormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");

  const { data: actions = [], isLoading } = useQuery<KnowledgeBaseAction[]>({
    queryKey: ["/api/knowledge/actions"],
  });

  const { data: stats } = useQuery<ActionStats>({
    queryKey: ["/api/knowledge/actions/stats"],
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const { handleCreate, handleUpdate, handleDelete, isMutating, isDeleting } = useCrudMutations<ActionFormData, ActionFormData>({
    baseUrl: "/api/knowledge/actions",
    queryKeys: ["/api/knowledge/actions", "/api/knowledge/actions/stats"],
    transformCreateData: transformFormData,
    transformUpdateData: transformFormData,
    onCreateSuccess: resetForm,
    onUpdateSuccess: resetForm,
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
    <CrudPageLayout
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
          options: ACTION_TYPE_OPTIONS,
          value: selectedActionType,
          onChange: setSelectedActionType,
        },
      ]}
      stats={stats ? { ...stats, labels: { total: "Acoes" } } : undefined}
      showForm={showForm}
      formTitle={editingId ? "Editar Acao" : "Nova Acao"}
      onOpenForm={() => {
        setFormData(emptyForm);
        setEditingId(null);
        setShowForm(true);
      }}
      onCloseForm={resetForm}
      onSubmit={handleSubmit}
      isSaving={isMutating}
      isEditing={!!editingId}
      addButtonLabel="Nova Acao"
      isEmpty={filteredActions.length === 0}
      emptyState={
        <div className="text-center py-12 text-gray-500">
          {searchTerm || selectedActionType ? "Nenhuma acao encontrada com os filtros atuais" : "Nenhuma acao cadastrada"}
        </div>
      }
      formContent={
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="select"
              label="Tipo de Acao"
              required
              value={formData.actionType}
              onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
              options={ACTION_TYPE_OPTIONS}
              emptyOption="Selecione..."
            />
            <FormField
              type="checkbox"
              label="Ativo"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
          </div>

          <FormField
            type="text"
            label="Descricao"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Orientar alternativas quando o cliente nao esta logado..."
          />

          <FormField
            type="textarea"
            label="Template de Mensagem"
            value={formData.messageTemplate}
            onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
            rows={4}
            placeholder="Sem acesso a area logada, da pra seguir de duas formas..."
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              type="text"
              label="Input Obrigatorio"
              value={formData.requiredInput}
              onChange={(e) => setFormData({ ...formData, requiredInput: e.target.value })}
              placeholder="email, cpf, etc..."
            />
            <FormField
              type="text"
              label="Time Responsavel"
              value={formData.ownerTeam}
              onChange={(e) => setFormData({ ...formData, ownerTeam: e.target.value })}
              placeholder="Suporte N2, Financeiro..."
            />
            <FormField
              type="text"
              label="SLA"
              value={formData.sla}
              onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
              placeholder="24h, 48h..."
            />
          </div>
        </>
      }
    >
      {filteredActions.map((action) => (
        <CrudListItem
          key={action.id}
          isActive={action.isActive}
          onEdit={() => handleEdit(action)}
          onDelete={() => handleDelete(action.id)}
          isDeleting={isDeleting}
        >
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-800 flex-shrink-0">
            <Play className="w-3 h-3" />
            {getActionTypeLabel(action.actionType)}
          </span>
          <span className="text-sm text-gray-900 truncate">{action.description}</span>
          {!action.isActive && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
              Inativo
            </span>
          )}
        </CrudListItem>
      ))}
    </CrudPageLayout>
  );
}
