import { Sparkles } from "lucide-react";

interface SummaryData {
  product?: string | null;
  intent?: string | null;
  confidence?: number | null;
  text?: string | null;
}

interface ConversationSummaryProps {
  summary?: SummaryData | null;
}

export function ConversationSummary({ summary }: ConversationSummaryProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        {!summary ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
            <p>Resumo ainda não gerado</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Resumo da Conversa</h3>
            </div>
            
            <div className="space-y-3">
              {summary.product && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Produto:</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {summary.product}
                  </span>
                </div>
              )}
              
              {summary.intent && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Intenção:</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    {summary.intent}
                  </span>
                </div>
              )}
              
              {summary.confidence !== null && summary.confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Confiança:</span>
                  <span className="text-sm font-medium text-gray-700">
                    {summary.confidence}%
                  </span>
                </div>
              )}
              
              {summary.text && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {summary.text}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
