import { FileText, AlertCircle } from "lucide-react";
import type { HierarchyNode, KnowledgeBaseArticle } from "../../hooks/useKnowledgeBase";
import type { StatBadge } from "./types";

interface ProductNodeContentProps {
  node: HierarchyNode;
  parentName?: string;
  isProduct: boolean;
  isSubproduct: boolean;
  statBadges: StatBadge[];
  articleCount: number;
}

export function ProductNodeContent({ node, parentName, isProduct, isSubproduct, statBadges, articleCount }: ProductNodeContentProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className={`text-gray-900 break-words ${isProduct ? "text-base" : "text-sm"} font-medium`}>
          {isSubproduct && parentName && (
            <span className="text-gray-500">{parentName} &gt; </span>
          )}
          {node.name}
        </span>

        {statBadges.map((badge, idx) => (
          <span key={idx} className="hidden md:inline-flex items-center whitespace-nowrap text-xs text-gray-500">
            <span className="font-medium text-gray-700">{badge.count}</span>&nbsp;{badge.label}
          </span>
        ))}
        {articleCount > 0 && (
          <span className="hidden md:inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-600">
            <FileText className="w-3 h-3" />
            <span className="font-medium">{articleCount}</span> {articleCount === 1 ? "artigo" : "artigos"}
          </span>
        )}
      </div>

      {(statBadges.length > 0 || articleCount > 0) && (
        <div className="flex md:hidden flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
          {statBadges.map((badge, idx) => (
            <span key={idx} className="whitespace-nowrap">
              <span className="font-medium text-gray-700">{badge.count}</span> {badge.label}
            </span>
          ))}
          {articleCount > 0 && (
            <span className="flex items-center gap-1 whitespace-nowrap text-emerald-600">
              <FileText className="w-3 h-3" />
              <span className="font-medium">{articleCount}</span> {articleCount === 1 ? "artigo" : "artigos"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface SubjectNodeContentProps {
  node: HierarchyNode;
  articleCount: number;
}

export function SubjectNodeContent({ node, articleCount }: SubjectNodeContentProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-gray-900 break-words text-sm font-medium">
          {node.name}
        </span>

        {articleCount > 0 && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-600">
            <FileText className="w-3 h-3" />
            <span className="font-medium">{articleCount}</span> {articleCount === 1 ? "artigo" : "artigos"}
          </span>
        )}

        {articleCount === 0 && (
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
      </div>
    </div>
  );
}

interface IntentNodeContentProps {
  node: HierarchyNode;
  articleCount: number;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onAddArticle?: (subjectId?: number, intentId?: number, fullPath?: string, productCatalogId?: number) => void;
}

export function IntentNodeContent({ node, articleCount, onEdit, onAddArticle }: IntentNodeContentProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-gray-900 break-words text-sm">
          {node.name}
          {articleCount > 0 && node.articles[0]?.question && (
            <span className="text-gray-500 font-normal">: {node.articles[0].question}</span>
          )}
        </span>

        {articleCount > 0 && (
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

        {articleCount === 0 && (
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
    </div>
  );
}
