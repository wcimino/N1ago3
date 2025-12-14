import { useState, useMemo } from "react";
import { X, Check, Loader2, Plus } from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableActionItem } from "./SortableActionItem";
import { ActionSelectorModal } from "./ActionSelectorModal";
import type { ProductCatalogItem, KnowledgeBaseAction, SolutionAction } from "../../../types";
import { ACTION_TYPE_LABELS } from "@shared/constants/actionTypes";

export interface SolutionFormData {
  name: string;
  description: string;
  productId: number | null;
  isActive: boolean;
  selectedActionIds: number[];
}

interface SolutionFormProps {
  formData: SolutionFormData;
  setFormData: React.Dispatch<React.SetStateAction<SolutionFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditing: boolean;
  productCatalog: ProductCatalogItem[];
  allActions: KnowledgeBaseAction[];
}

export function SolutionForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditing,
  productCatalog,
  allActions,
}: SolutionFormProps) {
  const [formSelectedProduto, setFormSelectedProduto] = useState<string>(() => {
    if (formData.productId) {
      const product = productCatalog.find(p => p.id === formData.productId);
      return product?.produto || "";
    }
    return "";
  });
  const [showActionModal, setShowActionModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const getActionTypeLabel = (type: string) => ACTION_TYPE_LABELS[type] || type;

  const handleFormDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFormData(prev => {
        const oldIndex = prev.selectedActionIds.indexOf(Number(active.id));
        const newIndex = prev.selectedActionIds.indexOf(Number(over.id));
        return {
          ...prev,
          selectedActionIds: arrayMove(prev.selectedActionIds, oldIndex, newIndex),
        };
      });
    }
  };

  const handleRemoveAction = (actionId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedActionIds: prev.selectedActionIds.filter(id => id !== actionId),
    }));
  };

  const handleConfirmAddActions = (actionIds: number[]) => {
    setFormData(prev => {
      const existingIds = new Set(prev.selectedActionIds);
      const newIds = actionIds.filter(id => !existingIds.has(id));
      return {
        ...prev,
        selectedActionIds: [...prev.selectedActionIds, ...newIds],
      };
    });
    setShowActionModal(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isEditing ? "Editar Solução" : "Nova Solução"}
        </h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produto
            </label>
            <select
              value={formSelectedProduto}
              onChange={(e) => {
                setFormSelectedProduto(e.target.value);
                setFormData(prev => ({ ...prev, productId: null }));
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
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                productId: e.target.value ? parseInt(e.target.value) : null 
              }))}
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
          <FormField
            type="text"
            label="Nome"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nome da solução..."
          />

          <FormField
            type="checkbox"
            label="Ativo"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="flex items-center"
          />
        </div>

        <FormField
          type="textarea"
          label="Descrição"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          placeholder="Descreva a solução..."
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Ações
            </label>
            <button
              type="button"
              onClick={() => setShowActionModal(true)}
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
                        onRemove={handleRemoveAction}
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
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <Check className="w-4 h-4" />
            {isEditing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>

      {showActionModal && (
        <ActionSelectorModal
          availableActions={formAvailableActions}
          onClose={() => setShowActionModal(false)}
          onConfirm={handleConfirmAddActions}
          getActionTypeLabel={getActionTypeLabel}
        />
      )}
    </div>
  );
}
