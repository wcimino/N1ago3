import { Sparkles, User, Headphones, Clock, Info as InfoIcon } from "lucide-react";
import {
  SummaryCardItem,
  ProductRow,
  RequestTypeRow,
  ObjectiveProblemsCard,
  ArticlesAndProblemsCard,
  TriageCard,
  ClientRequestVersionsTooltip,
  emotionConfig,
  type SummaryData,
} from "./summary";

interface ConversationSummaryProps {
  summary?: SummaryData | null;
}

export function ConversationSummary({ summary }: ConversationSummaryProps) {
  const hasStructuredData = summary?.client_request || summary?.agent_actions || summary?.current_status || summary?.important_info || summary?.objective_problems?.length || summary?.articles_and_objective_problems?.length || summary?.triage;

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
            
            <div className="space-y-2 mb-4">
              <ProductRow 
                product={summary.product}
                subproduct={summary.subproduct}
                confidence={summary.product_confidence}
                confidenceReason={summary.product_confidence_reason}
              />
              
              <RequestTypeRow
                requestType={summary.customer_request_type}
                confidence={summary.customer_request_type_confidence}
                confidenceReason={summary.customer_request_type_reason}
              />
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 min-w-[110px]">Sentimento:</span>
                {summary.customer_emotion_level && emotionConfig[summary.customer_emotion_level] ? (
                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${emotionConfig[summary.customer_emotion_level].color}`}>
                    {emotionConfig[summary.customer_emotion_level].emoji} {emotionConfig[summary.customer_emotion_level].label}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-sm font-medium">
                    (vazio)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {summary.client_request && (
                <div className={`rounded-lg p-3 bg-blue-50 border border-blue-200`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-blue-600"><User className="w-4 h-4" /></div>
                    <h4 className="font-medium text-gray-800 text-sm">Solicitação do Cliente</h4>
                    <ClientRequestVersionsTooltip versions={summary.client_request_versions} />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{summary.client_request}</p>
                </div>
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
                  icon={<InfoIcon className="w-4 h-4" />}
                  title="Informações Importantes"
                  content={summary.important_info}
                  bgColor="bg-purple-50"
                  borderColor="border-purple-200"
                  iconColor="text-purple-600"
                />
              )}
              
              <ObjectiveProblemsCard problems={summary.objective_problems} />
              
              <ArticlesAndProblemsCard items={summary.articles_and_objective_problems} />
              
              {summary.triage && (
                <TriageCard triage={summary.triage} />
              )}
              
              {!hasStructuredData && summary.text && (
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
