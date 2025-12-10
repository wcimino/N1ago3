import { ChevronRight, ChevronDown, Pencil, Trash2, AlertCircle, Plus, Minus, FileText } from "lucide-react";
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

interface StatBadge {
  count: number;
  label: string;
}

function getStatBadges(stats: NodeStats, level: string): StatBadge[] {
  const badges: StatBadge[] = [];
  
  if (level === "produto" && stats.subproductCount > 0) {
    badges.push({ count: stats.subproductCount, label: stats.subproductCount === 1 ? "subproduto" : "subprodutos" });
  }
  if ((level === "produto" || level === "subproduto") && stats.subjectCount > 0) {
    badges.push({ count: stats.subjectCount, label: stats.subjectCount === 1 ? "assunto" : "assuntos" });
  }
  if ((level !== "intencao") && stats.intentCount > 0) {
    badges.push({ count: stats.intentCount, label: stats.intentCount === 1 ? "intenção" : "intenções" });
  }
  
  return badges;
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
  const statBadges = getStatBadges(stats, node.level);
  const colors = LEVEL_COLORS[node.level];
  const isProduct = node.level === "produto";
  const isSubproduct = node.level === "subproduto";
  const isAssunto = node.level === "assunto";
  const isIntencao = node.level === "intencao";
  const useNestedStyle = isAssunto || isIntencao;
  
  const mobileIndent = depth * 12;
  const desktopIndent = depth * 20;
  
  return (
    <div className={(isProduct || isSubproduct) ? "mb-2" : ""}>
      <div 
        className={`
          group rounded-lg transition-colors
          ${hasChildren ? "cursor-pointer" : ""}
          ${isProduct 
            ? "bg-white border border-gray-200 shadow-sm hover:shadow-md p-3 sm:p-4" 
            : isSubproduct
              ? "bg-white border border-gray-200 shadow-sm hover:shadow-md p-3 sm:p-4"
              : "hover:bg-gray-50 py-2 px-2 sm:px-3"
          }
        `}
        style={{ 
          marginLeft: `max(${mobileIndent}px, min(${desktopIndent}px, calc(${mobileIndent}px + (${desktopIndent - mobileIndent}px) * ((100vw - 320px) / 400))))` 
        }}
        onClick={() => hasChildren && onToggle(node.fullPath)}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          {hasChildren ? (
            <button className="p-0.5 rounded hover:bg-gray-200 mt-0.5 shrink-0">
              {useNestedStyle ? (
                isExpanded ? (
                  <Minus className="w-4 h-4 text-gray-500" />
                ) : (
                  <Plus className="w-4 h-4 text-gray-500" />
                )
              ) : (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )
              )}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`px-2 py-0.5 text-xs rounded border shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}>
                {LEVEL_LABELS[node.level]}
              </span>
              
              <span className={`font-medium text-gray-900 break-words ${isProduct ? "text-base" : "text-sm"}`}>
                {node.name}
              </span>

              {(isProduct || isSubproduct) && (
                <>
                  {statBadges.map((badge, idx) => (
                    <span key={idx} className="hidden md:inline-flex items-center whitespace-nowrap text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{badge.count}</span>&nbsp;{badge.label}
                    </span>
                  ))}
                  {stats.articleCount > 0 && (
                    <span className="hidden md:inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-600">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium">{stats.articleCount}</span> {stats.articleCount === 1 ? "artigo" : "artigos"}
                    </span>
                  )}
                </>
              )}

              {stats.articleCount === 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0 sm:hidden">
                  <AlertCircle className="w-3 h-3" />
                  <span>0</span>
                </span>
              )}

              {stats.articleCount === 0 && (
                <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  Sem artigos
                </span>
              )}
            </div>

            {(isProduct || isSubproduct) && (statBadges.length > 0 || stats.articleCount > 0) && (
              <div className="flex md:hidden flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
                {statBadges.map((badge, idx) => (
                  <span key={idx} className="whitespace-nowrap">
                    <span className="font-medium text-gray-700">{badge.count}</span> {badge.label}
                  </span>
                ))}
                {stats.articleCount > 0 && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-emerald-600">
                    <FileText className="w-3 h-3" />
                    <span className="font-medium">{stats.articleCount}</span> {stats.articleCount === 1 ? "artigo" : "artigos"}
                  </span>
                )}
              </div>
            )}

            {!isProduct && !isSubproduct && stats.articleCount > 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <FileText className="w-3 h-3" />
                <span className="font-medium">{stats.articleCount}</span> {stats.articleCount === 1 ? "artigo" : "artigos"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onAddArticle && node.level === "intencao" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddArticle(node.subjectId, node.intentId, node.fullPath);
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                title="Adicionar artigo"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className={isProduct ? "mt-1" : ""}>
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
              className="flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 group"
              style={{ 
                marginLeft: `max(${(depth + 1) * 12}px, min(${(depth + 1) * 20}px, calc(${(depth + 1) * 12}px + (${((depth + 1) * 20) - ((depth + 1) * 12)}px) * ((100vw - 320px) / 400))))` 
              }}
            >
              <div className="w-5 shrink-0" />

              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-900 break-words">
                  {article.name || article.description.substring(0, 60)}
                </span>
                <span className="block sm:hidden text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>

              <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block shrink-0">
                {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
              </span>

              <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(article); }}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
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
