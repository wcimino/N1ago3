import { ChevronRight, ChevronDown, Pencil, Trash2, AlertCircle, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LEVEL_LABELS, LEVEL_COLORS } from "../../../lib/productHierarchy";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";

function countArticles(node: HierarchyNode): number {
  let count = node.articles.length;
  for (const child of node.children) {
    count += countArticles(child);
  }
  return count;
}

interface HierarchyNodeItemProps {
  node: HierarchyNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
  onAddArticle?: (subjectId?: number, intentId?: number, productName?: string) => void;
}

export function HierarchyNodeItem({ node, depth, expandedPaths, onToggle, onEdit, onDelete, onAddArticle }: HierarchyNodeItemProps) {
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.length > 0 || node.articles.length > 0;
  const articleCount = countArticles(node);
  const colors = LEVEL_COLORS[node.level];
  
  return (
    <div>
      <div 
        className={`group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 ${hasChildren ? "cursor-pointer" : ""}`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => hasChildren && onToggle(node.fullPath)}
      >
        {hasChildren ? (
          <button className="p-0.5 rounded hover:bg-gray-200">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className={`px-2 py-0.5 text-xs rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
          {LEVEL_LABELS[node.level]}
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{node.name}</span>

        {onAddArticle && node.level === "intencao" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const productName = node.fullPath.split(" > ")[0];
              onAddArticle(node.subjectId, node.intentId, productName);
            }}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Adicionar artigo"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {articleCount === 0 ? (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            Sem artigos
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            {articleCount}
          </span>
        )}
      </div>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <HierarchyNodeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddArticle={onAddArticle}
            />
          ))}
          {node.articles.map((article) => (
            <div 
              key={article.id}
              className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
              style={{ marginLeft: `${(depth + 1) * 20}px` }}
            >
              <div className="w-5" />

              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-900 truncate block">
                  {article.name || article.description.substring(0, 60)}
                </span>
              </div>

              <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
                {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(article); }}
                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
