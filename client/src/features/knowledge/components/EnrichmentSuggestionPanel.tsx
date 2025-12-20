import { Sparkles, Check, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { DiffPreview } from "./DiffView";
import type { EnrichmentSuggestion } from "../hooks/useInlineEnrichment";

interface CurrentData {
  question: string;
  answer: string;
  keywords: string;
  questionVariation: string[];
}

interface EnrichmentSuggestionPanelProps {
  suggestion: EnrichmentSuggestion | null;
  skipReason: string | null;
  apiError: string | null;
  isError: boolean;
  error: Error | null;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  currentData: CurrentData;
  onApply: (suggestion: EnrichmentSuggestion) => void;
  onDiscard: () => void;
}

export function EnrichmentSuggestionPanel({
  suggestion,
  skipReason,
  apiError,
  isError,
  error,
  expanded,
  setExpanded,
  currentData,
  onApply,
  onDiscard,
}: EnrichmentSuggestionPanelProps) {
  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
      onDiscard();
    }
  };

  const hasContent = isError || apiError || skipReason || suggestion;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="space-y-3">
      {(isError || apiError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              {apiError || (error as any)?.message || "Erro ao gerar sugestão"}
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
                label="Resposta"
                before={currentData.answer}
                after={suggestion.answer}
              />

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-700">Palavras-chave:</span>
                {(() => {
                  const existingKws = currentData.keywords ? currentData.keywords.split(",").map(k => k.trim()).filter(k => k) : [];
                  const newKws = (suggestion.keywords ? suggestion.keywords.split(",").map(k => k.trim()).filter(k => k) : []).filter(k => !existingKws.includes(k));
                  return (
                    <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200">
                      <div className="flex flex-wrap gap-1">
                        {existingKws.map((k, i) => (
                          <span key={`existing-${i}`} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {k}
                          </span>
                        ))}
                        {newKws.map((k, i) => (
                          <span key={`new-${i}`} className="bg-green-200 text-green-700 px-2 py-0.5 rounded text-xs">
                            + {k}
                          </span>
                        ))}
                        {existingKws.length === 0 && newKws.length === 0 && (
                          <span className="text-gray-400 italic">Sem palavras-chave</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-700">Variações da Pergunta:</span>
                {(() => {
                  const existingVars = currentData.questionVariation || [];
                  const newVars = (suggestion.questionVariation || []).filter(v => !existingVars.includes(v));
                  return (
                    <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200">
                      <div className="flex flex-wrap gap-1">
                        {existingVars.map((v, i) => (
                          <span key={`existing-${i}`} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {v}
                          </span>
                        ))}
                        {newVars.map((v, i) => (
                          <span key={`new-${i}`} className="bg-green-200 text-green-700 px-2 py-0.5 rounded text-xs">
                            + {v}
                          </span>
                        ))}
                        {existingVars.length === 0 && newVars.length === 0 && (
                          <span className="text-gray-400 italic">Sem variações</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {suggestion.questionNormalized && suggestion.questionNormalized.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-gray-700">Versões Normalizadas (para busca):</span>
                  <div className="text-sm p-3 rounded border bg-blue-50 border-blue-200">
                    <div className="flex flex-wrap gap-1">
                      {suggestion.questionNormalized.map((v, i) => (
                        <span key={i} className="bg-green-200 text-green-700 px-2 py-0.5 rounded text-xs">
                          + {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                  type="button"
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Sugestão
                </button>
                <button
                  type="button"
                  onClick={onDiscard}
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
