import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { 
  ProductTreeNode, 
  ProductLevelType,
  LEVEL_LABELS,
  getNextLevels
} from "../../../lib/productHierarchy";
import { ConfirmModal } from "../../../shared/components/ui/ConfirmModal";

interface ProductTreeActionsProps {
  node: ProductTreeNode;
  onAdd: (node: ProductTreeNode, level: ProductLevelType) => void;
  onEdit: (node: ProductTreeNode) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

export function ProductTreeActions({ 
  node, 
  onAdd, 
  onEdit, 
  onDelete,
  isDeleting 
}: ProductTreeActionsProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canAddChildren = node.level !== "subproduto";
  const nextLevels = getNextLevels(node.level);

  const handleAddClick = () => {
    if (nextLevels.length === 1) {
      onAdd(node, nextLevels[0]);
    } else {
      setShowAddMenu(!showAddMenu);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (node.productId) {
      onDelete(node.productId);
    }
  };

  const canEdit = node.productId || node.level === "produto";
  const canDelete = node.productId;

  return (
    <>
      {canAddChildren && nextLevels.length > 0 && (
        <div className="relative">
          <button
            onClick={handleAddClick}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Adicionar"
          >
            <Plus className="w-4 h-4" />
          </button>
          {showAddMenu && nextLevels.length > 1 && (
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {nextLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    onAdd(node, level);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {canEdit && (
        <button
          onClick={() => onEdit(node)}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir item"
        message={`Tem certeza que deseja excluir "${node.name}"?\n\nEsta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </>
  );
}
