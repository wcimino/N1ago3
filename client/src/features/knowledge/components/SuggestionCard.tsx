import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";
import type { KnowledgeArticle } from "../../../types";
import { SuggestionCardBase } from "./SuggestionCardBase";

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

  const renderActions = () => {
    if (showRejectReason) {
      return (
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
      );
    }

    return (
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
    );
  };

  return (
    <SuggestionCardBase
      suggestion={suggestion}
      originalArticle={originalArticle ? {
        id: originalArticle.id,
        description: originalArticle.description,
        resolution: originalArticle.resolution,
        observations: originalArticle.observations,
        question: originalArticle.question,
        answer: originalArticle.answer,
        keywords: originalArticle.keywords,
        questionVariation: originalArticle.questionVariation,
      } : null}
      isLoadingArticle={isLoadingArticle}
      isProcessing={isApproving || isRejecting}
      showRejectionReason={true}
      renderActions={renderActions}
    />
  );
}
