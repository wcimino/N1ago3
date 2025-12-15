import { Sparkles, User, Headphones, Clock, Info as InfoIcon, Cross, AlertTriangle, BookOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Triage, ObjectiveProblemIdentified, ArticleAndProblemResult } from "../types/conversations";

interface SummaryData {
  product?: string | null;
  subproduct?: string | null;
  product_confidence?: number | null;
  product_confidence_reason?: string | null;
  text?: string | null;
  client_request?: string | null;
  agent_actions?: string | null;
  current_status?: string | null;
  important_info?: string | null;
  customer_emotion_level?: number | null;
  customer_request_type?: string | null;
  customer_request_type_confidence?: number | null;
  customer_request_type_reason?: string | null;
  objective_problems?: ObjectiveProblemIdentified[] | null;
  articles_and_objective_problems?: ArticleAndProblemResult[] | null;
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

interface ConfidenceTooltipProps {
  confidence?: number | null;
  reason?: string | null;
}

function ConfidenceTooltip({ confidence, reason }: ConfidenceTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    }
    
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  const handleClick = () => {
    if (!showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowTooltip(!showTooltip);
  };
  
  if (confidence === null || confidence === undefined) return null;
  
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm text-gray-500">({confidence}%)</span>
      {reason && (
        <>
          <button
            ref={buttonRef}
            onClick={handleClick}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Ver explicação"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
          {showTooltip && createPortal(
            <div 
              ref={tooltipRef}
              className="fixed z-[9999] w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              {reason}
              <button 
                onClick={() => setShowTooltip(false)}
                className="absolute top-1 right-1 text-gray-400 hover:text-white p-1"
              >
                ×
              </button>
            </div>,
            document.body
          )}
        </>
      )}
    </span>
  );
}

interface ProductRowProps {
  product?: string | null;
  subproduct?: string | null;
  confidence?: number | null;
  confidenceReason?: string | null;
}

function ProductRow({ product, subproduct, confidence, confidenceReason }: ProductRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 min-w-[110px]">Produto:</span>
      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm font-medium">
        {product || "(vazio)"} {">"} {subproduct || "(vazio)"}
      </span>
      <ConfidenceTooltip confidence={confidence} reason={confidenceReason} />
    </div>
  );
}

interface RequestTypeRowProps {
  requestType?: string | null;
  confidence?: number | null;
  confidenceReason?: string | null;
}

function RequestTypeRow({ requestType, confidence, confidenceReason }: RequestTypeRowProps) {
  const getRequestTypeColor = (type: string | null | undefined) => {
    if (!type) return 'bg-gray-100 text-gray-500';
    const lower = type.toLowerCase();
    if (lower.includes('suporte')) return 'bg-orange-100 text-orange-700';
    if (lower.includes('contratar')) return 'bg-green-100 text-green-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 min-w-[110px]">Tipo de conversa:</span>
      <span className={`px-2 py-0.5 rounded text-sm font-medium ${getRequestTypeColor(requestType)}`}>
        {requestType || "(vazio)"}
      </span>
      <ConfidenceTooltip confidence={confidence} reason={confidenceReason} />
    </div>
  );
}

const severityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-green-100 text-green-700" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

interface MatchedTermsTooltipProps {
  matchedTerms?: string[] | null;
  bgColor?: string;
  textColor?: string;
}

function MatchedTermsTooltip({ matchedTerms, bgColor = "bg-cyan-100", textColor = "text-cyan-600" }: MatchedTermsTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    }
    
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  const handleClick = () => {
    if (!showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left - 100),
      });
    }
    setShowTooltip(!showTooltip);
  };
  
  if (!matchedTerms || matchedTerms.length === 0) return null;
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`${textColor} hover:opacity-70 transition-opacity ml-1`}
        title="Ver termos correspondentes"
      >
        <InfoIcon className="w-3.5 h-3.5" />
      </button>
      {showTooltip && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] w-48 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className="font-medium mb-1">Termos correspondentes:</div>
          <div className="flex flex-wrap gap-1">
            {matchedTerms.map((term, i) => (
              <span key={i} className={`${bgColor} ${textColor} px-1.5 py-0.5 rounded text-xs`}>
                {term}
              </span>
            ))}
          </div>
          <button 
            onClick={() => setShowTooltip(false)}
            className="absolute top-1 right-1 text-gray-400 hover:text-white p-1"
          >
            ×
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

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
                <span className="flex items-center text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                  {problem.matchScore}%
                  <MatchedTermsTooltip matchedTerms={problem.matchedTerms} bgColor="bg-violet-100" textColor="text-violet-600" />
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

interface ArticlesAndProblemsCardProps {
  items?: ArticleAndProblemResult[] | null;
}

function ArticlesAndProblemsCard({ items }: ArticlesAndProblemsCardProps) {
  const itemsList = [...(items || [])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const hasItems = itemsList.length > 0;
  const articleCount = itemsList.filter(i => i.source === "article").length;
  const problemCount = itemsList.filter(i => i.source === "problem").length;
  
  return (
    <div className="rounded-lg p-3 bg-cyan-50 border border-cyan-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-cyan-600">
          <BookOpen className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Artigos e Problemas</h4>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700">
          {articleCount} artigo{articleCount !== 1 ? "s" : ""} / {problemCount} problema{problemCount !== 1 ? "s" : ""}
        </span>
      </div>
      
      {hasItems ? (
        <div className="space-y-2">
          {itemsList.map((item) => (
            <div key={`${item.source}-${item.id}`} className="bg-white rounded px-3 py-2 border border-cyan-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.source === "article" 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {item.source === "article" ? "Artigo" : "Problema"}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                </div>
                {item.matchScore !== undefined && (
                  <span className="flex items-center text-xs text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded">
                    {item.matchScore}%
                    <MatchedTermsTooltip matchedTerms={item.matchedTerms} bgColor="bg-cyan-100" textColor="text-cyan-600" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum artigo ou problema encontrado
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
            <p className="mt-0.5 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                triage.anamnese.customerRequestType.toLowerCase().includes('suporte') 
                  ? 'bg-orange-100 text-orange-700'
                  : triage.anamnese.customerRequestType.toLowerCase().includes('contratar')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {triage.anamnese.customerRequestType}
              </span>
              {triage.anamnese.customerRequestTypeConfidence && (
                <span className="text-gray-500 text-xs">
                  Confiança: <span className="font-medium">{triage.anamnese.customerRequestTypeConfidence}</span>
                </span>
              )}
            </p>
            {triage.anamnese.customerRequestTypeReason && (
              <p className="text-gray-500 text-xs mt-1 italic">
                {triage.anamnese.customerRequestTypeReason}
              </p>
            )}
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
