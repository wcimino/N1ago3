import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../../lib/queryClient";

export interface EnrichmentSuggestion {
  answer: string;
  keywords: string;
  questionVariation: string[];
  questionNormalized: string[];
  updateReason: string;
  confidenceScore: number | null;
  sourceArticles: Array<{ id: string; title: string; similarityScore: number }>;
}

interface EnrichmentResponse {
  success: boolean;
  action?: "update" | "skip";
  suggestion?: EnrichmentSuggestion;
  skipReason?: string;
  confidenceScore?: number;
  error?: string;
}

interface CurrentData {
  question: string;
  answer: string;
  keywords: string;
  questionVariation: string[];
}

interface UseInlineEnrichmentProps {
  intentId: number | null;
  articleId?: number | null;
  currentData: CurrentData;
}

export function useInlineEnrichment({
  intentId,
  articleId,
  currentData,
}: UseInlineEnrichmentProps) {
  const [suggestion, setSuggestion] = useState<EnrichmentSuggestion | null>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const enrichMutation = useMutation({
    mutationFn: async (): Promise<EnrichmentResponse> => {
      if (!intentId) {
        throw new Error("É necessário selecionar uma intenção para enriquecer o artigo.");
      }
      const response = await apiRequest("POST", "/api/ai/article-enrichment/inline", {
        intentId,
        articleId,
        currentData: {
          question: (currentData.question || "").trim().slice(0, 5000),
          answer: (currentData.answer || "").trim().slice(0, 10000),
          keywords: (currentData.keywords || "").trim().slice(0, 1000),
          questionVariation: (currentData.questionVariation || []).map(v => String(v).trim().slice(0, 500)),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao gerar sugestão de enriquecimento");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.action === "update" && data.suggestion) {
        setSuggestion(data.suggestion);
        setSkipReason(null);
        setApiError(null);
        setExpanded(true);
      } else if (data.action === "skip") {
        setSuggestion(null);
        setSkipReason(data.skipReason || "O artigo já está adequado");
        setApiError(null);
      } else if (!data.success) {
        setSuggestion(null);
        setSkipReason(null);
        setApiError(data.error || "Erro ao processar enriquecimento");
      }
    },
    onError: (error: any) => {
      setSuggestion(null);
      setSkipReason(null);
      setApiError(error?.message || "Erro ao gerar sugestão");
    },
  });

  const handleEnrich = () => {
    setSuggestion(null);
    setSkipReason(null);
    setApiError(null);
    enrichMutation.mutate();
  };

  const handleDiscard = () => {
    setSuggestion(null);
    setSkipReason(null);
    setApiError(null);
    setExpanded(true);
  };

  return {
    suggestion,
    skipReason,
    apiError,
    expanded,
    setExpanded,
    isLoading: enrichMutation.isPending,
    isError: enrichMutation.isError,
    error: enrichMutation.error,
    handleEnrich,
    handleDiscard,
    isEnabled: !!intentId,
  };
}
