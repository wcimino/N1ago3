import { ChevronRight, ChevronDown, Pencil, Trash2, AlertCircle, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LEVEL_LABELS, LEVEL_COLORS } from "../../../lib/productHierarchy";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";

interface NodeStats {
  subproductCount: number;
  subjectCount: number;
  intentCount: number;
  articleCount: number;
}

function getNodeStats(node: HierarchyNode): NodeStats {
  let subproductCount = 0;
  let subjectCount = 0;
  let intentCount = 0;
  let articleCount = node.articles.length;

  for (const child of node.children) {
    if (child.level === "subproduto") subproductCount++;
    else if (child.level === "assunto") subjectCount++;
    else if (child.level === "intencao") intentCount++;
    
    const childStats = getNodeStats(child);
    subproductCount += childStats.subproductCount;
    subjectCount += childStats.subjectCount;
    intentCount += childStats.intentCount;
    articleCount += childStats.articleCount;
  }

  return { subproductCount, subjectCount, intentCount, articleCount };
}

function formatStats(stats: NodeStats, level: string): string {
  const parts: string[] = [];
  
  if (level === "produto" && stats.subproductCount > 0) {
    parts.push(`${stats.subproductCount} subproduto${stats.subproductCount > 1 ? 's' : ''}`);
  }
  if ((level === "produto" || level === "subproduto") && stats.subjectCount > 0) {
    parts.push(`${stats.subjectCount} assunto${stats.subjectCount > 1 ? 's' : ''}`);
  }
  if ((level !== "intencao") && stats.intentCount > 0) {
    parts.push(`${stats.intentCount} intenç${stats.intentCount > 1 ? 'ões' : 'ão'}`);
  }
  if (stats.articleCount > 0) {
    parts.push(`${stats.articleCount} artigo${stats.articleCount > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
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
  const stats = getNodeStats(node);
  const statsText = formatStats(stats, node.level);
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

        <span className="text-sm font-medium text-gray-900">{node.name}</span>

        {statsText && (
          <span className="text-xs text-gray-400 ml-1">
            {statsText}
          </span>
        )}

        <div className="flex-1" />

        {onAddArticle && node.level === "intencao" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddArticle(node.subjectId, node.intentId, node.fullPath);
            }}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Adicionar artigo"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {stats.articleCount === 0 ? (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            Sem artigos
          </span>
        ) : null}
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
