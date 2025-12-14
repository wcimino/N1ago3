import { useState } from "react";
import { X, Plus, Play } from "lucide-react";
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">Selecionar Ações</h4>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-500">
            {pendingActionIds.length} {pendingActionIds.length === 1 ? "ação selecionada" : "ações selecionadas"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
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
  );
}
