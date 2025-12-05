import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Clock, Package, Target } from "lucide-react";
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

export function ConversationSummaryCard({ summary }: ConversationSummaryCardProps) {
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
  const timeAgo = updatedAtDate 
    ? formatDistanceToNow(updatedAtDate, { addSuffix: true, locale: ptBR })
    : null;

  const hasClassification = summary.product || summary.intent;

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
                <span title={format(updatedAtDate, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}>
                  {timeAgo}
                </span>
              </div>
            )}
          </div>

          {hasClassification && (
            <div className="flex flex-wrap gap-2 mb-3">
              {summary.product && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <Package className="w-3 h-3" />
                  {summary.product}
                </div>
              )}
              {summary.intent && (
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${intentColors[summary.intent] || intentColors.outros}`}>
                  <Target className="w-3 h-3" />
                  {intentLabels[summary.intent] || summary.intent}
                </div>
              )}
              {summary.confidence !== null && (
                <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  {summary.confidence}% confiança
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary.text}
          </p>
        </div>
      </div>
    </div>
  );
}
