import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Check, X, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "../../../lib/queryClient";
import { DiffPreview } from "./DiffView";

interface EnrichmentSuggestion {
  question: string;
  answer: string;
  keywords: string;
  questionVariation: string[];
  updateReason: string;
  confidenceScore: number;
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

interface InlineEnrichmentPanelProps {
  intentId: number | null;
  articleId?: number | null;
  currentData: CurrentData;
  onApply: (suggestion: EnrichmentSuggestion) => void;
}

export function InlineEnrichmentPanel({
  intentId,
  articleId,
  currentData,
  onApply,
}: InlineEnrichmentPanelProps) {
  const [suggestion, setSuggestion] = useState<EnrichmentSuggestion | null>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const enrichMutation = useMutation({
    mutationFn: async (): Promise<EnrichmentResponse> => {
      if (!intentId) {
        throw new Error("É necessário selecionar uma intenção para enriquecer o artigo.");
      }
      const response = await apiRequest("POST", "/api/ai/enrichment/inline", {
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

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
      setSuggestion(null);
      setSkipReason(null);
      setApiError(null);
      setExpanded(true);
    }
  };

  const handleDiscard = () => {
    setSuggestion(null);
    setSkipReason(null);
    setApiError(null);
    setExpanded(true);
  };

  if (!intentId) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Selecione uma intenção para habilitar o enriquecimento com IA</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={handleEnrich}
          disabled={enrichMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {enrichMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Enriquecer com IA
            </>
          )}
        </button>
      </div>

      {(enrichMutation.isError || apiError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              {apiError || (enrichMutation.error as any)?.message || "Erro ao gerar sugestão"}
            </span>
          </div>
        </div>
      )}

      {skipReason && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700">
            <Check className="w-4 h-4" />
            <span className="text-sm">{skipReason}</span>
          </div>
        </div>
      )}

      {suggestion && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 bg-purple-100 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Sugestão de Melhoria</span>
              {suggestion.confidenceScore && (
                <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                  {suggestion.confidenceScore}% confiança
                </span>
              )}
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-purple-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-600" />
            )}
          </div>

          {expanded && (
            <div className="p-4 space-y-4">
              {suggestion.updateReason && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
                  <span className="text-xs font-medium text-orange-800">Motivo da melhoria:</span>
                  <p className="text-sm text-orange-700 mt-1">{suggestion.updateReason}</p>
                </div>
              )}

              <DiffPreview
                label="Pergunta"
                before={currentData.question}
                after={suggestion.question}
              />

              <DiffPreview
                label="Resposta"
                before={currentData.answer}
                after={suggestion.answer}
              />

              <DiffPreview
                label="Palavras-chave"
                before={currentData.keywords}
                after={suggestion.keywords}
              />

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-700">Variações da Pergunta:</span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Atual:</div>
                    {currentData.questionVariation.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {currentData.questionVariation.map((v, i) => (
                          <span key={i} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Sem variações</span>
                    )}
                  </div>
                  <div className="text-sm p-3 rounded border bg-green-50 border-green-200">
                    <div className="text-xs text-green-600 mb-1">Sugerido:</div>
                    <div className="flex flex-wrap gap-1">
                      {suggestion.questionVariation.map((v, i) => (
                        <span key={i} className="bg-green-200 text-green-700 px-2 py-0.5 rounded text-xs">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {suggestion.sourceArticles && suggestion.sourceArticles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-gray-700">Artigos de referência:</span>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.sourceArticles.map((article, i) => (
                      <span 
                        key={i} 
                        className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                        title={`Similaridade: ${(article.similarityScore * 100).toFixed(0)}%`}
                      >
                        {article.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-purple-200">
                <button
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Sugestão
                </button>
                <button
                  onClick={handleDiscard}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
