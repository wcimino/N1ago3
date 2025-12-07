import { useState } from "react";
import { Edit2, Trash2, ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KnowledgeBaseArticle {
  id: number;
  productStandard: string;
  subproductStandard: string | null;
  category1?: string | null;
  category2?: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseCardProps {
  article: KnowledgeBaseArticle;
  onEdit: () => void;
  onDelete: () => void;
}

export function KnowledgeBaseCard({ article, onEdit, onDelete }: KnowledgeBaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(article.updatedAt), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span className="font-medium text-blue-600">{article.productStandard}</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-600">{article.intent}</span>
            </div>

            <p className="text-sm text-gray-900 font-medium leading-snug line-clamp-2 mb-2">
              {article.description}
            </p>

            <div className="bg-green-50 rounded-lg px-3 py-2 border-l-2 border-green-500">
              <p className="text-xs text-green-800 line-clamp-2">
                {article.resolution}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <span>{timeAgo}</span>
              {article.subproductStandard && (
                <>
                  <span>•</span>
                  <span>{article.subproductStandard}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(!showActions);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showActions && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(false);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActions(false);
                        onEdit();
                      }}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActions(false);
                        onDelete();
                      }}
                      className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-gray-50 p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Situação
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {article.description}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
              Solução
            </h4>
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {article.resolution}
              </p>
            </div>
          </div>

          {article.observations && (
            <div>
              <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                Observações
              </h4>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {article.observations}
                </p>
              </div>
            </div>
          )}

          <div className="pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>ID #{article.id}</span>
            <span>Criado: {new Date(article.createdAt).toLocaleDateString("pt-BR")}</span>
            <span>Atualizado: {new Date(article.updatedAt).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
