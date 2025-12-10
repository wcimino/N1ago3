import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";
import type { KnowledgeArticle } from "../../../types";
import { DiffPreview } from "./DiffView";
import { StatusBadge, ConfidenceBadge, SuggestionTypeBadge, QualityFlags } from "./SuggestionBadges";
import { SourceArticlesBadge } from "./SourceArticlesBadge";

interface SuggestionCardProps { 
  suggestion: KnowledgeSuggestion;
  onApprove: (id: number) => void;
  onReject: (params: { id: number; reason?: string }) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function SuggestionCard({ 
  suggestion, 
  onApprove, 
  onReject,
  isApproving,
  isRejecting,
}: SuggestionCardProps) {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  const isUpdate = suggestion.suggestionType === "update" && suggestion.similarArticleId;
  
  const { data: originalArticle, isLoading: isLoadingArticle } = useQuery<KnowledgeArticle>({
    queryKey: ["knowledge-article", suggestion.similarArticleId],
    queryFn: () => fetchApi<KnowledgeArticle>(`/api/knowledge/articles/${suggestion.similarArticleId}`),
    enabled: !!isUpdate,
  });

  const handleReject = () => {
    if (showRejectReason) {
      onReject({ id: suggestion.id, reason: rejectReason });
      setShowRejectReason(false);
      setRejectReason("");
    } else {
      setShowRejectReason(true);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SuggestionTypeBadge type={suggestion.suggestionType} targetArticleId={suggestion.similarArticleId} />
          <StatusBadge status={suggestion.status} />
          <ConfidenceBadge score={suggestion.confidenceScore} />
        </div>
        <span className="text-xs text-gray-500">
          {new Date(suggestion.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>
      
      {suggestion.suggestionType === "update" && suggestion.updateReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
          <span className="text-xs font-medium text-orange-800">Motivo da atualização:</span>
          <p className="text-sm text-orange-700 mt-1">{suggestion.updateReason}</p>
        </div>
      )}

      <QualityFlags flags={suggestion.qualityFlags} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {suggestion.productStandard && (
          <div>
            <span className="text-gray-500">Produto:</span>
            <p className="font-medium">{suggestion.productStandard}</p>
          </div>
        )}
        <div>
          <span className="text-gray-500">Subproduto:</span>
          <p className={suggestion.subproductStandard ? "font-medium" : "text-gray-400 italic"}>
            {suggestion.subproductStandard || "(vazio)"}
          </p>
        </div>
        {suggestion.rawExtraction?.subjectName && (
          <div>
            <span className="text-gray-500">Assunto:</span>
            <p className="font-medium">{suggestion.rawExtraction.subjectName}</p>
          </div>
        )}
        {suggestion.rawExtraction?.intentName && (
          <div>
            <span className="text-gray-500">Intenção:</span>
            <p className="font-medium">{suggestion.rawExtraction.intentName}</p>
          </div>
        )}
      </div>

      {isUpdate ? (
        isLoadingArticle ? (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando artigo original para comparação...</span>
            </div>
          </div>
        ) : originalArticle ? (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <ArrowRight className="w-4 h-4" />
              <span>Comparação: Artigo #{suggestion.similarArticleId} → Sugestão de melhoria</span>
            </div>
            
            <DiffPreview
              label="Situação"
              before={originalArticle.description}
              after={suggestion.description}
            />
            
            <DiffPreview
              label="Solução"
              before={originalArticle.resolution}
              after={suggestion.resolution}
            />
            
            <DiffPreview
              label="Observações"
              before={originalArticle.observations}
              after={suggestion.observations}
            />
          </div>
        ) : (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Artigo original #{suggestion.similarArticleId} não encontrado</span>
            </div>
          </div>
        )
      ) : (
        <>
          {suggestion.description && (
            <div>
              <span className="text-xs text-gray-500">Situação:</span>
              <p className="text-sm mt-1">{suggestion.description}</p>
            </div>
          )}

          {suggestion.resolution && (
            <div>
              <span className="text-xs text-gray-500">Solução:</span>
              <p className="text-sm mt-1 bg-green-50 p-2 rounded">{suggestion.resolution}</p>
            </div>
          )}

          {suggestion.observations && (
            <div>
              <span className="text-xs text-gray-500">Observações:</span>
              <p className="text-sm mt-1 text-gray-600">{suggestion.observations}</p>
            </div>
          )}
        </>
      )}

      <SourceArticlesBadge rawExtraction={suggestion.rawExtraction} />

      {suggestion.status === "pending" && (
        <div className="pt-2 border-t">
          {showRejectReason ? (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Confirmar Rejeição
                </button>
                <button
                  onClick={() => setShowRejectReason(false)}
                  className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(suggestion.id)}
                disabled={isApproving}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Aprovar
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}

      {suggestion.status === "rejected" && suggestion.rejectionReason && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Motivo da rejeição:</span>
          <p className="text-sm text-red-600 mt-1">{suggestion.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}
