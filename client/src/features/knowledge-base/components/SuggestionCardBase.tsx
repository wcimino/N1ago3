import { Check, X, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";
import { DiffPreview } from "./DiffView";
import { StatusBadge, ConfidenceBadge, SuggestionTypeBadge, QualityFlags } from "./SuggestionBadges";
import { SourceArticlesBadge } from "./SourceArticlesBadge";

interface OriginalArticle {
  id: number;
  description: string | null;
  resolution: string | null;
  internalActions?: string | null;
  observations?: string | null;
  question?: string | null;
  answer?: string | null;
  keywords?: string | null;
  questionVariation?: string[] | null;
}

interface SuggestionCardBaseProps {
  suggestion: KnowledgeSuggestion;
  originalArticle?: OriginalArticle | null;
  isLoadingArticle?: boolean;
  isProcessing?: boolean;
  showRejectionReason?: boolean;
  alwaysShowActions?: boolean;
  renderActions?: () => React.ReactNode;
}

export function SuggestionCardBase({
  suggestion,
  originalArticle,
  isLoadingArticle = false,
  isProcessing = false,
  showRejectionReason = true,
  alwaysShowActions = false,
  renderActions,
}: SuggestionCardBaseProps) {
  const isUpdate = suggestion.suggestionType === "update" && suggestion.similarArticleId;
  const shouldShowActions = alwaysShowActions || suggestion.status === "pending";

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
              <span>Comparação: Artigo #{originalArticle.id} → Sugestão de melhoria</span>
            </div>

            {(suggestion.question || suggestion.rawExtraction?.originalQuestion) && (
              <DiffPreview
                label="Pergunta"
                before={suggestion.rawExtraction?.originalQuestion || originalArticle.question || ""}
                after={suggestion.question}
              />
            )}

            {(suggestion.answer || suggestion.rawExtraction?.originalAnswer) && (
              <DiffPreview
                label="Resposta"
                before={suggestion.rawExtraction?.originalAnswer || originalArticle.answer || ""}
                after={suggestion.answer}
              />
            )}

            {(suggestion.keywords || suggestion.rawExtraction?.originalKeywords) && (
              <DiffPreview
                label="Keywords"
                before={suggestion.rawExtraction?.originalKeywords || originalArticle.keywords || ""}
                after={suggestion.keywords}
              />
            )}

            {suggestion.questionVariation && suggestion.questionVariation.length > 0 && (
              <div>
                <span className="text-xs text-gray-500">Variações de pergunta sugeridas:</span>
                <ul className="mt-1 space-y-1">
                  {suggestion.questionVariation.map((variation, idx) => (
                    <li key={idx} className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                      {idx + 1}. {variation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(originalArticle.description || suggestion.description) && (
              <DiffPreview
                label="Situação (legado)"
                before={originalArticle.description}
                after={suggestion.description}
              />
            )}

            {(originalArticle.resolution || suggestion.resolution) && (
              <DiffPreview
                label="Solução (legado)"
                before={originalArticle.resolution}
                after={suggestion.resolution}
              />
            )}
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
          {suggestion.question && (
            <div>
              <span className="text-xs text-gray-500">Pergunta:</span>
              <p className="text-sm mt-1 bg-blue-50 p-2 rounded">{suggestion.question}</p>
            </div>
          )}

          {suggestion.answer && (
            <div>
              <span className="text-xs text-gray-500">Resposta:</span>
              <p className="text-sm mt-1 bg-green-50 p-2 rounded">{suggestion.answer}</p>
            </div>
          )}

          {suggestion.keywords && (
            <div>
              <span className="text-xs text-gray-500">Keywords:</span>
              <p className="text-sm mt-1 text-gray-600">{suggestion.keywords}</p>
            </div>
          )}

          {suggestion.questionVariation && suggestion.questionVariation.length > 0 && (
            <div>
              <span className="text-xs text-gray-500">Variações:</span>
              <ul className="mt-1 space-y-1">
                {suggestion.questionVariation.map((variation, idx) => (
                  <li key={idx} className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                    {idx + 1}. {variation}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
        </>
      )}

      <SourceArticlesBadge rawExtraction={suggestion.rawExtraction} />

      {shouldShowActions && renderActions && (
        <div className="pt-2 border-t">
          {renderActions()}
        </div>
      )}

      {showRejectionReason && suggestion.status === "rejected" && suggestion.rejectionReason && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Motivo da rejeição:</span>
          <p className="text-sm text-red-600 mt-1">{suggestion.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}
