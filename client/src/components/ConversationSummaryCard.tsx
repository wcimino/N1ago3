import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Clock } from "lucide-react";
import type { ConversationSummary } from "../types/conversations";

interface ConversationSummaryCardProps {
  summary: ConversationSummary | null;
}

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
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary.text}
          </p>
        </div>
      </div>
    </div>
  );
}
