import { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface CrudListItemProps {
  isActive?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  children: ReactNode;
  className?: string;
}

export function CrudListItem({
  isActive = true,
  onEdit,
  onDelete,
  isDeleting,
  children,
  className = "",
}: CrudListItemProps) {
  return (
    <div
      className={`bg-white border rounded-lg px-4 py-2 ${
        isActive ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {children}
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
    </div>
  );
}
