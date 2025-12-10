import { Sparkles, Clock, Package, Target } from "lucide-react";
import { useDateFormatters } from "../../../shared/hooks";
import type { ConversationSummary } from "../types/conversations";

interface ConversationSummaryCardProps {
  summary: ConversationSummary | null;
}

const intentLabels: Record<string, string> = {
  contratar: "Quer contratar",
  suporte: "Precisa de suporte",
  cancelar: "Quer cancelar",
  duvida: "Tem dúvidas",
  reclamacao: "Reclamação",
  outros: "Outros",
};

const intentColors: Record<string, string> = {
  contratar: "bg-green-100 text-green-700",
  suporte: "bg-blue-100 text-blue-700",
  cancelar: "bg-red-100 text-red-700",
  duvida: "bg-yellow-100 text-yellow-700",
  reclamacao: "bg-orange-100 text-orange-700",
  outros: "bg-gray-100 text-gray-700",
};

const emotionConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "bg-green-100 text-green-700", emoji: "😊" },
  2: { label: "Positivo", color: "bg-emerald-100 text-emerald-700", emoji: "🙂" },
  3: { label: "Neutro", color: "bg-gray-100 text-gray-600", emoji: "😐" },
  4: { label: "Irritado", color: "bg-orange-100 text-orange-700", emoji: "😤" },
  5: { label: "Muito irritado", color: "bg-red-100 text-red-700", emoji: "😠" },
};

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
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${intentColors[summary.intent || "outros"] || intentColors.outros}`}>
                  <Target className="w-3 h-3" />
                  {summary.subject || "(vazio)"} {">"} {intentLabels[summary.intent || ""] || summary.intent || "(vazio)"}
                </div>
                {summary.confidence !== null && (
                  <span className="text-gray-500 text-xs">{summary.confidence}%</span>
                )}
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
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary.text}
          </p>
        </div>
      </div>
    </div>
  );
}
