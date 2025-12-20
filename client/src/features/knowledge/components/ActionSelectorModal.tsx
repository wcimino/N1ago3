import { useState } from "react";
import { Plus, Play } from "lucide-react";
import { BaseModal } from "../../../shared/components/ui/BaseModal";
import { Button } from "../../../shared/components/ui/Button";
import type { KnowledgeBaseAction } from "../../../types";

interface ActionSelectorModalProps {
  availableActions: KnowledgeBaseAction[];
  onClose: () => void;
  onConfirm: (actionIds: number[]) => void;
  getActionTypeLabel: (type: string) => string;
}

export function ActionSelectorModal({
  availableActions,
  onClose,
  onConfirm,
  getActionTypeLabel,
}: ActionSelectorModalProps) {
  const [pendingActionIds, setPendingActionIds] = useState<number[]>([]);

  const handleTogglePendingAction = (actionId: number) => {
    if (pendingActionIds.includes(actionId)) {
      setPendingActionIds(pendingActionIds.filter(id => id !== actionId));
    } else {
      setPendingActionIds([...pendingActionIds, actionId]);
    }
  };

  const handleConfirm = () => {
    onConfirm(pendingActionIds);
  };

  const footer = (
    <>
      <span className="text-sm text-gray-500 mr-auto">
        {pendingActionIds.length} {pendingActionIds.length === 1 ? "ação selecionada" : "ações selecionadas"}
      </span>
      <Button onClick={onClose} variant="secondary">
        Cancelar
      </Button>
      <Button
        onClick={handleConfirm}
        disabled={pendingActionIds.length === 0}
        className="flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Adicionar
      </Button>
    </>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title="Selecionar Ações"
      maxWidth="lg"
      footer={footer}
    >
      {availableActions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Todas as ações já foram adicionadas.
        </p>
      ) : (
        <div className="space-y-2">
          {availableActions.map((action) => {
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
    </BaseModal>
  );
}
