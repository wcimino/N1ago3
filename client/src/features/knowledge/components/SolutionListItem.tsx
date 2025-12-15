import { Pencil, Trash2, ChevronDown, ChevronUp, Puzzle, Plus, Play, ArrowUp, ArrowDown, X } from "lucide-react";
import type { KnowledgeBaseSolution, KnowledgeBaseAction, SolutionWithActions, ProductCatalogItem } from "../../../types";

interface SolutionListItemProps {
  solution: KnowledgeBaseSolution;
  isExpanded: boolean;
  expandedSolution: SolutionWithActions | undefined;
  productCatalog: ProductCatalogItem[];
  availableActions: KnowledgeBaseAction[];
  showActionSelector: boolean;
  isDeleting: boolean;
  isAddingAction: boolean;
  isRemovingAction: boolean;
  isReordering: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActionSelector: () => void;
  onAddAction: (actionId: number) => void;
  onRemoveAction: (actionId: number) => void;
  onMoveAction: (actionId: number, direction: "up" | "down") => void;
  getActionTypeLabel: (type: string) => string;
}

export function SolutionListItem({
  solution,
  isExpanded,
  expandedSolution,
  productCatalog,
  availableActions,
  showActionSelector,
  isDeleting,
  isAddingAction,
  isRemovingAction,
  isReordering,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActionSelector,
  onAddAction,
  onRemoveAction,
  onMoveAction,
  getActionTypeLabel,
}: SolutionListItemProps) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div
        className={`px-4 py-2 ${
          solution.isActive ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onToggleExpand}
              className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
            >
              {isExpanded ? (
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
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Excluir"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {solution.description && (
          <p className="text-sm text-gray-500 mt-1 ml-8 truncate">{solution.description}</p>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Ações da Solução</h4>
            <button
              onClick={onToggleActionSelector}
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
                      onClick={() => onAddAction(action.id)}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-violet-50 transition-colors flex items-center gap-2"
                      disabled={isAddingAction}
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
                      onClick={() => onMoveAction(action.id, "up")}
                      disabled={index === 0 || isReordering}
                      className="p-0.5 text-gray-400 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onMoveAction(action.id, "down")}
                      disabled={index === expandedSolution.actions.length - 1 || isReordering}
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
                    onClick={() => onRemoveAction(action.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remover ação"
                    disabled={isRemovingAction}
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
  );
}
