import { ChevronRight, ChevronDown, Pencil, AlertCircle, Plus, Minus, FileText, X, BarChart3, Eye, Bot } from "lucide-react";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";
import { ArticleListItem } from "./ArticleListItem";
import { LEVEL_LABELS, LEVEL_COLORS, getNodeStats, getStatBadges } from "../utils";

interface HierarchyNodeItemProps {
  node: HierarchyNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
  onAddArticle?: (subjectId?: number, intentId?: number, fullPath?: string, productCatalogId?: number) => void;
  onAddSubject?: (productId: number) => void;
  onAddIntent?: (subjectId: number) => void;
  onEditIntent?: (intentId: number, intentName: string) => void;
  onEditSubject?: (subjectId: number, subjectName: string) => void;
  onDeleteSubject?: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onDeleteIntent?: (intentId: number, intentName: string, hasArticles: boolean) => void;
  onToggleVisibility?: (articleId: number, currentValue: boolean) => void;
  onToggleAutoReply?: (articleId: number, currentValue: boolean) => void;
  parentName?: string;
  intentViewCountMap?: Map<number, number>;
}

export function HierarchyNodeItem({ node, depth, expandedPaths, onToggle, onEdit, onDelete, onAddArticle, onAddSubject, onAddIntent, onEditIntent, onEditSubject, onDeleteSubject, onDeleteIntent, onToggleVisibility, onToggleAutoReply, parentName, intentViewCountMap }: HierarchyNodeItemProps) {
  const isProduct = node.level === "produto";
  const isSubproduct = node.level === "subproduto";
  const isAssunto = node.level === "assunto";
  const isIntencao = node.level === "intencao";
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = isIntencao ? false : (node.children.length > 0 || node.articles.length > 0);
  const stats = getNodeStats(node);
  const statBadges = getStatBadges(stats, node.level);
  const useNestedStyle = isAssunto || isIntencao;
  
  const depthIndent = depth * 20;
  const intentExtra = isIntencao ? 28 : 0;
  const indentPx = depthIndent + intentExtra;
  
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
        style={{ marginLeft: indentPx }}
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
                isExpanded ? <Minus className="w-4 h-4 text-gray-500" /> : <Plus className="w-4 h-4 text-gray-500" />
              ) : (
                isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />
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
                {isIntencao && node.articles.length > 0 && node.articles[0].question && (
                  <span className="text-gray-500 font-normal">: {node.articles[0].question}</span>
                )}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (node.articles.length > 0) {
                        onEdit(node.articles[0]);
                      }
                    }}
                    className="text-blue-500 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                    title="Editar artigo"
                  >
                    (Editar artigo)
                  </button>
                </span>
              )}

              {isAssunto && stats.articleCount === 0 && (
                <>
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0 sm:hidden">
                    <AlertCircle className="w-3 h-3" />
                    <span>0</span>
                  </span>
                  <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                    <AlertCircle className="w-3 h-3" />
                    Sem artigos
                  </span>
                </>
              )}

              {isIntencao && stats.articleCount === 0 && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  Sem artigos
                  {onAddArticle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddArticle(node.subjectId, node.intentId, node.fullPath, node.productId);
                      }}
                      className="text-blue-500 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                      title="Criar artigo"
                    >
                      (Criar artigo)
                    </button>
                  )}
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

          <NodeActionButtons
            node={node}
            isProduct={isProduct}
            isSubproduct={isSubproduct}
            isAssunto={isAssunto}
            isIntencao={isIntencao}
            stats={stats}
            onAddSubject={onAddSubject}
            onAddIntent={onAddIntent}
            onEditSubject={onEditSubject}
            onDeleteSubject={onDeleteSubject}
            onEditIntent={onEditIntent}
            onDeleteIntent={onDeleteIntent}
            onToggleVisibility={onToggleVisibility}
            onToggleAutoReply={onToggleAutoReply}
            intentViewCountMap={intentViewCountMap}
            article={isIntencao && node.articles.length > 0 ? node.articles[0] : undefined}
          />
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
                onEditIntent={onEditIntent}
                onEditSubject={onEditSubject}
                onDeleteSubject={onDeleteSubject}
                onDeleteIntent={onDeleteIntent}
                onToggleVisibility={onToggleVisibility}
                onToggleAutoReply={onToggleAutoReply}
                intentViewCountMap={intentViewCountMap}
              />
            ))}
            {node.articles.map((article) => (
              <ArticleListItem 
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
                onEditIntent={onEditIntent}
                onEditSubject={onEditSubject}
                onDeleteSubject={onDeleteSubject}
                onDeleteIntent={onDeleteIntent}
                onToggleVisibility={onToggleVisibility}
                onToggleAutoReply={onToggleAutoReply}
                parentName={node.name}
                intentViewCountMap={intentViewCountMap}
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
              onEditIntent={onEditIntent}
              onEditSubject={onEditSubject}
              onDeleteSubject={onDeleteSubject}
              onDeleteIntent={onDeleteIntent}
              onToggleVisibility={onToggleVisibility}
              onToggleAutoReply={onToggleAutoReply}
              intentViewCountMap={intentViewCountMap}
            />
          ))}
          {node.articles.map((article) => (
            <ArticleListItem 
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

interface NodeActionButtonsProps {
  node: HierarchyNode;
  isProduct: boolean;
  isSubproduct: boolean;
  isAssunto: boolean;
  isIntencao: boolean;
  stats: { articleCount: number };
  onAddSubject?: (productId: number) => void;
  onAddIntent?: (subjectId: number) => void;
  onEditSubject?: (subjectId: number, subjectName: string) => void;
  onDeleteSubject?: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onEditIntent?: (intentId: number, intentName: string) => void;
  onDeleteIntent?: (intentId: number, intentName: string, hasArticles: boolean) => void;
  onToggleVisibility?: (articleId: number, currentValue: boolean) => void;
  onToggleAutoReply?: (articleId: number, currentValue: boolean) => void;
  intentViewCountMap?: Map<number, number>;
  article?: KnowledgeBaseArticle;
}

function NodeActionButtons({ node, isProduct, isSubproduct, isAssunto, isIntencao, stats, onAddSubject, onAddIntent, onEditSubject, onDeleteSubject, onEditIntent, onDeleteIntent, onToggleVisibility, onToggleAutoReply, intentViewCountMap, article }: NodeActionButtonsProps) {
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
      {isIntencao && article && onToggleVisibility && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(article.id, article.visibleInSearch);
          }}
          className={`p-1.5 rounded transition-colors ${
            article.visibleInSearch 
              ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' 
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
          }`}
          title={article.visibleInSearch ? "Visível na busca (clique para ocultar)" : "Oculto na busca (clique para mostrar)"}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
      {isIntencao && article && onToggleAutoReply && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleAutoReply(article.id, article.availableForAutoReply);
          }}
          className={`p-1.5 rounded transition-colors ${
            article.availableForAutoReply 
              ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' 
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
          }`}
          title={article.availableForAutoReply ? "Disponível para resposta automática (clique para desativar)" : "Indisponível para resposta automática (clique para ativar)"}
        >
          <Bot className="w-4 h-4" />
        </button>
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
