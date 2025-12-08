import { Sparkles, User, Headphones, Clock, Info } from "lucide-react";

interface SummaryData {
  product?: string | null;
  intent?: string | null;
  confidence?: number | null;
  text?: string | null;
  client_request?: string | null;
  agent_actions?: string | null;
  current_status?: string | null;
  important_info?: string | null;
  customer_emotion_level?: number | null;
}

const emotionConfig: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "bg-green-100 text-green-700", emoji: "😊" },
  2: { label: "Positivo", color: "bg-emerald-100 text-emerald-700", emoji: "🙂" },
  3: { label: "Neutro", color: "bg-gray-100 text-gray-600", emoji: "😐" },
  4: { label: "Irritado", color: "bg-orange-100 text-orange-700", emoji: "😤" },
  5: { label: "Muito irritado", color: "bg-red-100 text-red-700", emoji: "😠" },
};

interface ConversationSummaryProps {
  summary?: SummaryData | null;
}

interface SummaryCardItemProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}

function SummaryCardItem({ icon, title, content, bgColor, borderColor, iconColor }: SummaryCardItemProps) {
  return (
    <div className={`rounded-lg p-3 ${bgColor} border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={iconColor}>{icon}</div>
        <h4 className="font-medium text-gray-800 text-sm">{title}</h4>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
    </div>
  );
}

export function ConversationSummary({ summary }: ConversationSummaryProps) {
  const hasStructuredData = summary?.client_request || summary?.agent_actions || summary?.current_status || summary?.important_info;

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
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Resumo da Conversa</h3>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {summary.customer_emotion_level && emotionConfig[summary.customer_emotion_level] && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Sentimento:</span>
                  <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${emotionConfig[summary.customer_emotion_level].color}`}>
                    {emotionConfig[summary.customer_emotion_level].emoji} {emotionConfig[summary.customer_emotion_level].label}
                  </span>
                </div>
              )}
              
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
            </div>

            {hasStructuredData ? (
              <div className="flex flex-col gap-3">
                {summary.client_request && (
                  <SummaryCardItem
                    icon={<User className="w-4 h-4" />}
                    title="Solicitação do Cliente"
                    content={summary.client_request}
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200"
                    iconColor="text-blue-600"
                  />
                )}
                
                {summary.agent_actions && (
                  <SummaryCardItem
                    icon={<Headphones className="w-4 h-4" />}
                    title="Ações do Atendente"
                    content={summary.agent_actions}
                    bgColor="bg-green-50"
                    borderColor="border-green-200"
                    iconColor="text-green-600"
                  />
                )}
                
                {summary.current_status && (
                  <SummaryCardItem
                    icon={<Clock className="w-4 h-4" />}
                    title="Status Atual"
                    content={summary.current_status}
                    bgColor="bg-amber-50"
                    borderColor="border-amber-200"
                    iconColor="text-amber-600"
                  />
                )}
                
                {summary.important_info && (
                  <SummaryCardItem
                    icon={<Info className="w-4 h-4" />}
                    title="Informações Importantes"
                    content={summary.important_info}
                    bgColor="bg-purple-50"
                    borderColor="border-purple-200"
                    iconColor="text-purple-600"
                  />
                )}
              </div>
            ) : summary.text ? (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {summary.text}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
