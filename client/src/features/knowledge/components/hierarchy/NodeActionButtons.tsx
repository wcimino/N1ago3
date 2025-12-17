import { Plus, Pencil, X, BarChart3 } from "lucide-react";
import { LEVEL_LABELS, LEVEL_COLORS } from "../../utils";
import type { NodeActionButtonsProps } from "./types";

export function NodeActionButtons({ 
  node, 
  isProduct, 
  isSubproduct, 
  isAssunto, 
  isIntencao, 
  stats, 
  onAddSubject, 
  onAddIntent, 
  onEditSubject, 
  onDeleteSubject, 
  onEditIntent, 
  onDeleteIntent, 
  intentViewCountMap 
}: NodeActionButtonsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {onAddSubject && (isProduct || isSubproduct) && node.productId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSubject(node.productId!);
          }}
          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-opacity"
          title="Adicionar assunto"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      {onAddIntent && isAssunto && node.subjectId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddIntent(node.subjectId!);
          }}
          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-opacity"
          title="Adicionar intenção"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      {onEditSubject && isAssunto && node.subjectId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditSubject(node.subjectId!, node.name);
          }}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-opacity"
          title="Editar assunto"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {onDeleteSubject && isAssunto && node.subjectId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSubject(node.subjectId!, node.name, stats.articleCount > 0);
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-opacity"
          title="Excluir assunto"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {isIntencao && stats.articleCount > 0 && node.intentId && intentViewCountMap && (
        <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium" title="Acessos via IA">
          <BarChart3 className="w-3 h-3" />
          {intentViewCountMap.get(node.intentId) ?? 0}
        </span>
      )}
      {onEditIntent && isIntencao && node.intentId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditIntent(node.intentId!, node.name);
          }}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-opacity"
          title="Editar intenção"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {onDeleteIntent && isIntencao && node.intentId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteIntent(node.intentId!, node.name, stats.articleCount > 0);
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-opacity"
          title="Excluir intenção"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <span className={`inline-flex px-2 py-0.5 text-xs rounded border whitespace-nowrap ${LEVEL_COLORS[node.level]?.bg || "bg-gray-50"} ${LEVEL_COLORS[node.level]?.text || "text-gray-700"} ${LEVEL_COLORS[node.level]?.border || "border-gray-200"}`}>
        {LEVEL_LABELS[node.level] || node.level}
      </span>
    </div>
  );
}
