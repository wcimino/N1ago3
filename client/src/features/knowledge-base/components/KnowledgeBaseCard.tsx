import { useState } from "react";
import { Edit2, Trash2, ChevronDown, ChevronUp, Package, Target, FileText, CheckCircle, MessageSquare } from "lucide-react";

interface KnowledgeBaseArticle {
  id: number;
  productStandard: string;
  subproductStandard: string | null;
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

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              <Package className="w-3 h-3" />
              {article.productStandard}
            </span>
            {article.subproductStandard && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                {article.subproductStandard}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
              <Target className="w-3 h-3" />
              {article.intent}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600 truncate">{article.description}</p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t space-y-4 bg-white">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4" />
              Descrição
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{article.description}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Resolução
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-green-50 p-3 rounded-lg border border-green-100">
              {article.resolution}
            </p>
          </div>

          {article.observations && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                Observações
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-amber-50 p-3 rounded-lg border border-amber-100">
                {article.observations}
              </p>
            </div>
          )}

          <div className="text-xs text-gray-400 pt-2 border-t">
            Atualizado em: {new Date(article.updatedAt).toLocaleString("pt-BR")}
          </div>
        </div>
      )}
    </div>
  );
}
