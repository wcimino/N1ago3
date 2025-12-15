import { Sparkles, Clock, Package, Target } from "lucide-react";
import { useDateFormatters } from "../../../shared/hooks";
import { emotionConfig, intentConfig } from "../../../shared/constants";
import type { ConversationSummary } from "../types/conversations";

interface ConversationSummaryCardProps {
  summary: ConversationSummary | null;
}

export function ConversationSummaryCard({ summary }: ConversationSummaryCardProps) {
  const { formatDateTime, formatRelativeTime } = useDateFormatters();

  if (!summary) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Resumo ainda não gerado</span>
        </div>
      </div>
    );
  }

  const updatedAtDate = summary.updated_at ? new Date(summary.updated_at) : null;
  const timeAgo = updatedAtDate ? formatRelativeTime(updatedAtDate) : null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-purple-900">Resumo da Conversa</h4>
            {timeAgo && updatedAtDate && (
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <Clock className="w-3 h-3" />
                <span title={formatDateTime(updatedAtDate)}>
                  {timeAgo}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 mb-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[70px]">Produto:</span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                <Package className="w-3 h-3" />
                {summary.product || "Sem classificação"} {">"} {summary.subproduct || "(vazio)"}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[70px]">Intenção:</span>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${intentConfig[summary.intent || "outros"]?.color || intentConfig.outros.color}`}>
                <Target className="w-3 h-3" />
                {summary.subject || "(vazio)"} {">"} {intentConfig[summary.intent || ""]?.label || summary.intent || "(vazio)"}
              </div>
            </div>
            {summary.customer_emotion_level && emotionConfig[summary.customer_emotion_level] && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[70px]">Sentimento:</span>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${emotionConfig[summary.customer_emotion_level].color}`}>
                  <span>{emotionConfig[summary.customer_emotion_level].emoji}</span>
                  {emotionConfig[summary.customer_emotion_level].label}
                </div>
              </div>
            )}
            {summary.confidence !== null && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[70px]">Confiança:</span>
                <span className="text-gray-700 text-sm">{summary.confidence}%</span>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary.text}
          </p>
        </div>
      </div>
    </div>
  );
}
