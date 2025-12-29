import { Sparkles, User, Headphones, Clock, Info as InfoIcon, CheckCircle2 } from "lucide-react";
import {
  SummaryCardItem,
  ProductRow,
  RequestTypeRow,
  ObjectiveProblemsCard,
  SolutionCenterCard,
  SolutionCard,
  TriageCard,
  OrchestratorLogsCard,
  ClientRequestVersionsTooltip,
  DemandFinderTooltip,
  ClientProfileCard,
  emotionConfig,
  type SummaryData,
  type ClientRequestVersions,
} from "./summary";

interface ParsedClientRequest {
  clientRequest?: string;
  clientRequestVersions?: ClientRequestVersions;
}

function extractClientRequestData(
  clientRequest: string | object | null | undefined,
  clientRequestVersions: ClientRequestVersions | null | undefined
): { text: string; versions: ClientRequestVersions | null | undefined } | null {
  if (!clientRequest) return null;
  
  if (typeof clientRequest === 'string') {
    try {
      const parsed = JSON.parse(clientRequest);
      if (typeof parsed === 'object' && parsed !== null && 'clientRequest' in parsed) {
        return {
          text: parsed.clientRequest || '',
          versions: parsed.clientRequestVersions || clientRequestVersions
        };
      }
    } catch {
      // Not JSON, use as-is
    }
    return { text: clientRequest, versions: clientRequestVersions };
  }
  
  if (typeof clientRequest === 'object' && clientRequest !== null) {
    const obj = clientRequest as ParsedClientRequest;
    return {
      text: obj.clientRequest || '',
      versions: obj.clientRequestVersions || clientRequestVersions
    };
  }
  
  return null;
}

function tryParseJsonSummary(text: string | null | undefined): ParsedClientRequest | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && 'clientRequest' in parsed) {
      return parsed as ParsedClientRequest;
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

interface ConversationSummaryProps {
  summary?: SummaryData | null;
  conversationId?: number;
}

export function ConversationSummary({ summary, conversationId }: ConversationSummaryProps) {
  const hasStructuredData = summary?.client_request || summary?.agent_actions || summary?.current_status || summary?.important_info || summary?.objective_problems?.length || summary?.solution_center_articles_and_problems?.length || summary?.triage;

  return (
    <div className="p-4">
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
            
            <div className="mb-4">
              <ProductRow 
                product={summary.product}
                subproduct={summary.subproduct}
                confidence={summary.product_confidence}
                confidenceReason={summary.product_confidence_reason}
              />
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Tipo:</span>
                  <RequestTypeRow
                    requestType={summary.customer_request_type}
                    confidence={summary.customer_request_type_confidence}
                    confidenceReason={summary.customer_request_type_reason}
                    compact
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Sentimento:</span>
                  {summary.customer_emotion_level && emotionConfig[summary.customer_emotion_level] ? (
                    <span className={`text-sm ${emotionConfig[summary.customer_emotion_level].color.replace('bg-', '').replace('-100', '-700')}`}>
                      {emotionConfig[summary.customer_emotion_level].emoji} {emotionConfig[summary.customer_emotion_level].label}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Fase:</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    summary.orchestrator_status === 'providing_solution' 
                      ? 'bg-green-100 text-green-700' 
                      : summary.orchestrator_status === 'temp_demand_understood' 
                      ? 'bg-green-100 text-green-700' 
                      : summary.orchestrator_status === 'demand_understanding'
                      ? 'bg-yellow-100 text-yellow-700'
                      : summary.orchestrator_status === 'escalated'
                      ? 'bg-red-100 text-red-700'
                      : summary.orchestrator_status === 'temp_demand_not_understood'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {summary.orchestrator_status === 'new' && 'Nova'}
                    {summary.orchestrator_status === 'demand_understanding' && 'Entendendo'}
                    {summary.orchestrator_status === 'temp_demand_understood' && 'Identificada'}
                    {summary.orchestrator_status === 'providing_solution' && 'Solucionando'}
                    {summary.orchestrator_status === 'demand_resolving' && 'Resolvendo'}
                    {summary.orchestrator_status === 'temp_demand_not_understood' && 'Não compreendida'}
                    {summary.orchestrator_status === 'escalated' && 'Escalado'}
                    {summary.orchestrator_status === 'closed' && 'Fechado'}
                    {!summary.orchestrator_status && '-'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Demanda:</span>
                  {(() => {
                    const status = summary.demand_finder_status;
                    const count = summary.demand_finder_interaction_count || 0;
                    const isSearching = (status === 'not_started' || status === 'in_progress') && count > 0;
                    
                    let colorClass = 'bg-gray-100 text-gray-500';
                    if (status === 'demand_found') colorClass = 'bg-green-100 text-green-700';
                    else if (isSearching || status === 'in_progress') colorClass = 'bg-yellow-100 text-yellow-700';
                    else if (status === 'demand_not_found') colorClass = 'bg-blue-100 text-blue-700';
                    else if (status === 'error') colorClass = 'bg-red-100 text-red-700';
                    
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 ${colorClass}`}>
                        {status === 'demand_found' && (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            {`Encontrada (${count}/5)`}
                          </>
                        )}
                        {isSearching && `Em busca (${count}/5)`}
                        {status === 'not_started' && count === 0 && 'Não iniciado'}
                        {status === 'in_progress' && count === 0 && 'Buscando'}
                        {status === 'demand_not_found' && 'Não encontrada'}
                        {status === 'error' && 'Erro'}
                        {!status && 'Não iniciado'}
                      </span>
                    );
                  })()}
                  <DemandFinderTooltip logs={summary.conversation_orchestrator_log} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <ClientProfileCard data={summary.client_hub_data} />
              
              {(() => {
                const clientData = extractClientRequestData(summary.client_request, summary.client_request_versions);
                if (!clientData) return null;
                return (
                  <div className={`rounded-lg p-3 bg-blue-50 border border-blue-200`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-blue-600"><User className="w-4 h-4" /></div>
                      <h4 className="font-medium text-gray-800 text-sm">Solicitação do Cliente</h4>
                      <ClientRequestVersionsTooltip versions={clientData.versions} />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{clientData.text}</p>
                  </div>
                );
              })()}
              
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
              
              <SolutionCenterCard 
                items={summary.solution_center_articles_and_problems} 
                selectedId={summary.solution_center_selected_id}
                selectedReason={summary.solution_center_selected_reason}
                selectedConfidence={summary.solution_center_selected_confidence}
              />
              
              {conversationId && <SolutionCard conversationId={conversationId} />}
              
              {summary.conversation_orchestrator_log && summary.conversation_orchestrator_log.length > 0 && (
                <OrchestratorLogsCard logs={summary.conversation_orchestrator_log} />
              )}
              
              <ObjectiveProblemsCard problems={summary.objective_problems} />
              
              {summary.triage && (
                <TriageCard triage={summary.triage} />
              )}
              
              {!hasStructuredData && summary.text && (() => {
                const parsedJson = tryParseJsonSummary(summary.text);
                if (parsedJson?.clientRequest) {
                  return (
                    <div className={`rounded-lg p-3 bg-blue-50 border border-blue-200`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-blue-600"><User className="w-4 h-4" /></div>
                        <h4 className="font-medium text-gray-800 text-sm">Solicitação do Cliente</h4>
                        <ClientRequestVersionsTooltip versions={parsedJson.clientRequestVersions} />
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{parsedJson.clientRequest}</p>
                    </div>
                  );
                }
                return (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {summary.text}
                    </p>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
