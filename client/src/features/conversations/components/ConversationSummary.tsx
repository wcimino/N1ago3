import { Sparkles, User, Headphones, Clock, Info, Cross, AlertTriangle } from "lucide-react";
import type { Triage, ObjectiveProblemIdentified } from "../types/conversations";

interface SummaryData {
  product?: string | null;
  subproduct?: string | null;
  subject?: string | null;
  intent?: string | null;
  confidence?: number | null;
  text?: string | null;
  client_request?: string | null;
  agent_actions?: string | null;
  current_status?: string | null;
  important_info?: string | null;
  customer_emotion_level?: number | null;
  customer_request_type?: string | null;
  objective_problems?: ObjectiveProblemIdentified[] | null;
  triage?: Triage | null;
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

const severityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-green-100 text-green-700" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

interface ObjectiveProblemsCardProps {
  problems?: ObjectiveProblemIdentified[] | null;
}

function ObjectiveProblemsCard({ problems }: ObjectiveProblemsCardProps) {
  const problemsList = [...(problems || [])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const hasProblems = problemsList.length > 0;
  
  return (
    <div className="rounded-lg p-3 bg-violet-50 border border-violet-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-violet-600">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Problemas</h4>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
          {problemsList.length} identificado{problemsList.length !== 1 ? "s" : ""}
        </span>
      </div>
      
      {hasProblems ? (
        <div className="space-y-2">
          {problemsList.map((problem) => (
            <div key={problem.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-violet-100">
              <span className="text-sm text-gray-700 font-medium">{problem.name}</span>
              {problem.matchScore !== undefined && (
                <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                  {problem.matchScore}% match
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum problema identificado
        </div>
      )}
    </div>
  );
}

interface TriageCardProps {
  triage: Triage;
}

function TriageCard({ triage }: TriageCardProps) {
  const severity = severityConfig[triage.severity?.level] || { label: triage.severity?.level || "Desconhecida", color: "bg-gray-100 text-gray-700" };
  
  return (
    <div className="rounded-lg p-3 bg-rose-50 border border-rose-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-rose-600">
          <Cross className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Triagem</h4>
        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${severity.color}`}>
          {severity.label}
          <span className="ml-1 text-gray-400 font-normal">(severity.level)</span>
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        {triage.anamnese?.customerMainComplaint && (
          <div>
            <span className="font-medium text-gray-600">Queixa principal</span>
            <span className="text-gray-400 text-xs ml-1">(anamnese.customerMainComplaint)</span>
            <p className="text-gray-700 mt-0.5">{triage.anamnese.customerMainComplaint}</p>
          </div>
        )}

        {triage.anamnese?.customerRequestType && (
          <div>
            <span className="font-medium text-gray-600">Tipo de solicitação</span>
            <span className="text-gray-400 text-xs ml-1">(anamnese.customerRequestType)</span>
            <p className="mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                triage.anamnese.customerRequestType.toLowerCase().includes('suporte') 
                  ? 'bg-orange-100 text-orange-700'
                  : triage.anamnese.customerRequestType.toLowerCase().includes('contratar')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {triage.anamnese.customerRequestType}
              </span>
            </p>
          </div>
        )}
        
        {triage.anamnese?.customerDeclaredObjective && (
          <div>
            <span className="font-medium text-gray-600">Objetivo declarado</span>
            <span className="text-gray-400 text-xs ml-1">(anamnese.customerDeclaredObjective)</span>
            <p className="text-gray-700 mt-0.5">{triage.anamnese.customerDeclaredObjective}</p>
          </div>
        )}

        {triage.anamnese?.customerDeclaredHypothesis && (
          <div>
            <span className="font-medium text-gray-600">Hipótese do cliente</span>
            <span className="text-gray-400 text-xs ml-1">(anamnese.customerDeclaredHypothesis)</span>
            <p className="text-gray-700 mt-0.5 italic">"{triage.anamnese.customerDeclaredHypothesis}"</p>
          </div>
        )}

        {triage.anamnese?.customerKeyContext && triage.anamnese.customerKeyContext.length > 0 && (
          <div>
            <span className="font-medium text-gray-600">Contexto chave</span>
            <span className="text-gray-400 text-xs ml-1">(anamnese.customerKeyContext)</span>
            <ul className="list-disc list-inside mt-0.5 text-gray-700">
              {triage.anamnese.customerKeyContext.map((ctx, index) => (
                <li key={index}>{ctx}</li>
              ))}
            </ul>
          </div>
        )}
        
        {triage.objectiveProblems && triage.objectiveProblems.length > 0 && (
          <div>
            <span className="font-medium text-gray-600">Problemas identificados</span>
            <span className="text-gray-400 text-xs ml-1">(objectiveProblems)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {triage.objectiveProblems.map((problem, index) => (
                <span key={index} className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs">
                  {typeof problem === 'string' ? problem : problem.name}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {triage.severity?.redFlags && triage.severity.redFlags.length > 0 && (
          <div>
            <span className="font-medium text-gray-600">Red flags</span>
            <span className="text-gray-400 text-xs ml-1">(severity.redFlags)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {triage.severity.redFlags.map((flag, index) => (
                <span key={index} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {triage.severity?.rationale && (
          <div>
            <span className="font-medium text-gray-600">Justificativa</span>
            <span className="text-gray-400 text-xs ml-1">(severity.rationale)</span>
            <p className="text-gray-700 mt-0.5 italic">{triage.severity.rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationSummary({ summary }: ConversationSummaryProps) {
  const hasStructuredData = summary?.client_request || summary?.agent_actions || summary?.current_status || summary?.important_info || summary?.objective_problems?.length || summary?.triage;

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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 min-w-[70px]">Produto:</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                  {summary.product || "(vazio)"} {">"} {summary.subproduct || "(vazio)"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 min-w-[70px]">Intenção:</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm font-medium">
                  {summary.subject || "(vazio)"} {">"} {summary.intent || "(vazio)"}
                </span>
                {summary.confidence !== null && summary.confidence !== undefined && (
                  <span className="text-sm text-gray-500">
                    {summary.confidence}%
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 min-w-[70px]">Tipo de conversa:</span>
                {summary.customer_request_type ? (
                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${
                    summary.customer_request_type.toLowerCase().includes('suporte') 
                      ? 'bg-orange-100 text-orange-700'
                      : summary.customer_request_type.toLowerCase().includes('contratar')
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {summary.customer_request_type}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-sm font-medium">
                    (vazio)
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 min-w-[70px]">Sentimento:</span>
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
              
              <ObjectiveProblemsCard problems={summary.objective_problems} />
              
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
