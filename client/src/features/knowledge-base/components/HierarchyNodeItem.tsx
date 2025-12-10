import { ChevronRight, ChevronDown, Pencil, Trash2, AlertCircle, Plus, Minus, FileText, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";

interface NodeStats {
  subproductCount: number;
  subjectCount: number;
  intentCount: number;
  articleCount: number;
}

const LEVEL_LABELS: Record<string, string> = {
  produto: "Produto",
  subproduto: "Subproduto",
  assunto: "Assunto",
  intencao: "Intenção",
};

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  produto: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  subproduto: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  assunto: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  intencao: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

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
  onAddSubject?: (productId: number) => void;
  onAddIntent?: (subjectId: number) => void;
  onDeleteSubject?: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onDeleteIntent?: (intentId: number, intentName: string, hasArticles: boolean) => void;
  parentName?: string;
}

export function HierarchyNodeItem({ node, depth, expandedPaths, onToggle, onEdit, onDelete, onAddArticle, onAddSubject, onAddIntent, onDeleteSubject, onDeleteIntent, parentName }: HierarchyNodeItemProps) {
  const isProduct = node.level === "produto";
  const isSubproduct = node.level === "subproduto";
  const isAssunto = node.level === "assunto";
  const isIntencao = node.level === "intencao";
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = isIntencao ? false : (node.children.length > 0 || node.articles.length > 0);
  const stats = getNodeStats(node);
  const statBadges = getStatBadges(stats, node.level);
  const useNestedStyle = isAssunto || isIntencao;
  
  const baseIndent = isIntencao ? 40 : 0;
  const mobileIndent = baseIndent + depth * 12;
  const desktopIndent = baseIndent + depth * 20;
  
  return (
    <div className={(isProduct || isSubproduct) ? "mb-2" : ""}>
      <div 
        className={`
          group rounded-lg transition-colors
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
      >
        <div 
          className={`flex items-start gap-2 sm:gap-3 ${hasChildren ? "cursor-pointer" : ""}`}
          onClick={() => hasChildren && onToggle(node.fullPath)}
        >
          {hasChildren ? (
            <button 
              className="p-0.5 rounded hover:bg-gray-200 mt-0.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.fullPath);
              }}
            >
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
              <span className={`text-gray-900 break-words ${isProduct ? "text-base" : "text-sm"} ${(isProduct || isSubproduct || isAssunto) ? "font-medium" : ""}`}>
                {isSubproduct && parentName && (
                  <span className="text-gray-500">{parentName} &gt; </span>
                )}
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

              {isAssunto && stats.articleCount > 0 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-600">
                  <FileText className="w-3 h-3" />
                  <span className="font-medium">{stats.articleCount}</span> {stats.articleCount === 1 ? "artigo" : "artigos"}
                </span>
              )}

              {isIntencao && stats.articleCount > 0 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-600">
                  <FileText className="w-3 h-3" />
                  Com artigo
                </span>
              )}

              {isAssunto && stats.articleCount === 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0 sm:hidden">
                  <AlertCircle className="w-3 h-3" />
                  <span>0</span>
                </span>
              )}

              {isAssunto && stats.articleCount === 0 && (
                <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  Sem artigos
                </span>
              )}

              {isIntencao && stats.articleCount === 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
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
          </div>

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
            {onAddArticle && isIntencao && stats.articleCount === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddArticle(node.subjectId, node.intentId, node.fullPath);
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-opacity"
                title="Adicionar artigo"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {isIntencao && node.articles.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node.articles[0]);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-opacity"
                title="Editar artigo"
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
        </div>

        {isExpanded && (isProduct || isSubproduct) && (node.children.filter(c => c.level !== "subproduto").length > 0 || node.articles.length > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {node.children.filter(c => c.level !== "subproduto").map((child) => (
              <HierarchyNodeItem
                key={child.fullPath}
                node={child}
                depth={0}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddArticle={onAddArticle}
                onAddSubject={onAddSubject}
                onAddIntent={onAddIntent}
                onDeleteSubject={onDeleteSubject}
                onDeleteIntent={onDeleteIntent}
              />
            ))}
            {node.articles.map((article) => (
              <ArticleItem 
                key={article.id} 
                article={article} 
                depth={0}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
        {isExpanded && isProduct && node.children.filter(c => c.level === "subproduto").length > 0 && (
          <div className="mt-3">
            {node.children.filter(c => c.level === "subproduto").map((child) => (
              <HierarchyNodeItem
                key={child.fullPath}
                node={child}
                depth={0}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddArticle={onAddArticle}
                onAddSubject={onAddSubject}
                onAddIntent={onAddIntent}
                onDeleteSubject={onDeleteSubject}
                onDeleteIntent={onDeleteIntent}
                parentName={node.name}
              />
            ))}
          </div>
        )}
      </div>

      {isExpanded && !isProduct && !isSubproduct && !isIntencao && (
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
              onAddSubject={onAddSubject}
              onAddIntent={onAddIntent}
              onDeleteSubject={onDeleteSubject}
              onDeleteIntent={onDeleteIntent}
            />
          ))}
          {node.articles.map((article) => (
            <ArticleItem 
              key={article.id} 
              article={article} 
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ArticleItemProps {
  article: KnowledgeBaseArticle;
  depth: number;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
}

function ArticleItem({ article, depth, onEdit, onDelete }: ArticleItemProps) {
  const mobileIndent = depth * 12;
  const desktopIndent = depth * 20;
  
  return (
    <div 
      className="flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 group"
      style={{ 
        marginLeft: `max(${mobileIndent}px, min(${desktopIndent}px, calc(${mobileIndent}px + (${desktopIndent - mobileIndent}px) * ((100vw - 320px) / 400))))` 
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
  );
}
