import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Play } from "lucide-react";
import type { KnowledgeBaseAction } from "../../../types";

interface SortableActionItemProps {
  action: KnowledgeBaseAction;
  index: number;
  onRemove: (id: number) => void;
  getActionTypeLabel: (type: string) => string;
}

export function SortableActionItem({ action, index, onRemove, getActionTypeLabel }: SortableActionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
    >
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-violet-100 text-violet-700 rounded-full flex-shrink-0">
        {index + 1}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 flex-shrink-0">
        <Play className="w-3 h-3" />
        {getActionTypeLabel(action.actionType)}
      </span>
      <span className="flex-1 text-sm text-gray-900 truncate">{action.description}</span>
      <button
        type="button"
        onClick={() => onRemove(action.id)}
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        title="Remover ação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
