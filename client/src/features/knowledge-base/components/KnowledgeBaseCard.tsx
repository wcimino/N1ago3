import { useState } from "react";
import { Edit2, Trash2, ChevronDown, ChevronUp, Package, Target, FileText, CheckCircle, MessageSquare, Clock, Layers } from "lucide-react";
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

  const timeAgo = formatDistanceToNow(new Date(article.updatedAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                <Package className="w-3.5 h-3.5" />
                {article.productStandard}
              </span>
              {article.subproductStandard && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200">
                  <Layers className="w-3 h-3" />
                  {article.subproductStandard}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                <Target className="w-3.5 h-3.5" />
                {article.intent}
              </span>
              {article.category1 && (
                <span className="text-xs text-gray-500">
                  {article.category1}
                  {article.category2 && ` / ${article.category2}`}
                </span>
              )}
            </div>

            <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
              {article.description}
            </h3>

            <p className="text-sm text-gray-500 line-clamp-2">
              <span className="font-medium text-green-700">Solução:</span>{" "}
              {article.resolution}
            </p>

            <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Atualizado {timeAgo}
              </span>
              <span className="text-gray-300">•</span>
              <span>ID #{article.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={isExpanded ? "Recolher" : "Expandir"}
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
        <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-gray-50">
          <div className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Descrição do Problema
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded-lg border">
              {article.description}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Solução / Orientação
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-green-50 p-3 rounded-lg border border-green-200">
              {article.resolution}
            </p>
          </div>

          {article.observations && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                Observações
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-amber-50 p-3 rounded-lg border border-amber-200">
                {article.observations}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t">
            <span>
              Criado em: {new Date(article.createdAt).toLocaleString("pt-BR")}
            </span>
            <span>
              Atualizado em: {new Date(article.updatedAt).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
