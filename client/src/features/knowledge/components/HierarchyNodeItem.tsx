import { ChevronRight, ChevronDown, Plus, Minus } from "lucide-react";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";
import { ArticleListItem } from "./ArticleListItem";
import { getNodeStats, getStatBadges } from "../utils";
import { NodeActionButtons, ProductNodeContent, SubjectNodeContent, IntentNodeContent } from "./hierarchy";

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
  parentName?: string;
  intentViewCountMap?: Map<number, number>;
}

export function HierarchyNodeItem({ 
  node, 
  depth, 
  expandedPaths, 
  onToggle, 
  onEdit, 
  onDelete, 
  onAddArticle, 
  onAddSubject, 
  onAddIntent, 
  onEditIntent, 
  onEditSubject, 
  onDeleteSubject, 
  onDeleteIntent, 
  parentName, 
  intentViewCountMap 
}: HierarchyNodeItemProps) {
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

  const renderNodeContent = () => {
    if (isProduct || isSubproduct) {
      return (
        <ProductNodeContent 
          node={node} 
          parentName={parentName} 
          isProduct={isProduct} 
          isSubproduct={isSubproduct}
          statBadges={statBadges}
          articleCount={stats.articleCount}
        />
      );
    }
    
    if (isAssunto) {
      return <SubjectNodeContent node={node} articleCount={stats.articleCount} />;
    }
    
    if (isIntencao) {
      return (
        <IntentNodeContent 
          node={node} 
          articleCount={stats.articleCount} 
          onEdit={onEdit}
          onAddArticle={onAddArticle}
        />
      );
    }
    
    return null;
  };

  const renderExpandIcon = () => {
    if (!hasChildren) {
      return <div className="w-5 shrink-0" />;
    }

    return (
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
    );
  };

  const renderChildNodes = () => {
    const childProps = {
      expandedPaths,
      onToggle,
      onEdit,
      onDelete,
      onAddArticle,
      onAddSubject,
      onAddIntent,
      onEditIntent,
      onEditSubject,
      onDeleteSubject,
      onDeleteIntent,
      intentViewCountMap,
    };

    return node.children.map((child) => (
      <HierarchyNodeItem
        key={child.fullPath}
        node={child}
        depth={depth + 1}
        {...childProps}
      />
    ));
  };

  const renderArticles = (articleDepth: number) => {
    return node.articles.map((article) => (
      <ArticleListItem 
        key={article.id} 
        article={article} 
        depth={articleDepth}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ));
  };
  
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
          {renderExpandIcon()}
          {renderNodeContent()}
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
            intentViewCountMap={intentViewCountMap}
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
                intentViewCountMap={intentViewCountMap}
              />
            ))}
            {renderArticles(0)}
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
                parentName={node.name}
                intentViewCountMap={intentViewCountMap}
              />
            ))}
          </div>
        )}
      </div>

      {isExpanded && !isProduct && !isSubproduct && !isIntencao && (
        <div>
          {renderChildNodes()}
          {renderArticles(depth + 1)}
        </div>
      )}
    </div>
  );
}
