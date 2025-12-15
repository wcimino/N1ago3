import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Cross, Info as InfoIcon } from "lucide-react";
import { severityConfig } from "./config";
import type { Triage } from "./types";

export interface TriageCardProps {
  triage: Triage;
}

export function TriageCard({ triage }: TriageCardProps) {
  const severity = severityConfig[triage.severity?.level] || { label: triage.severity?.level || "Desconhecida", color: "bg-gray-100 text-gray-700" };
  
  const [showComplaintTooltip, setShowComplaintTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const complaintButtonRef = useRef<HTMLButtonElement>(null);
  const complaintTooltipRef = useRef<HTMLDivElement>(null);
  
  const hasComplaintVariants = triage.anamnese?.customerMainComplaintQuestionVersion || triage.anamnese?.customerMainComplaintProblemVersion;
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        complaintTooltipRef.current && 
        !complaintTooltipRef.current.contains(event.target as Node) &&
        complaintButtonRef.current &&
        !complaintButtonRef.current.contains(event.target as Node)
      ) {
        setShowComplaintTooltip(false);
      }
    }
    
    if (showComplaintTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showComplaintTooltip]);

  const handleComplaintTooltipClick = () => {
    if (!showComplaintTooltip && complaintButtonRef.current) {
      const rect = complaintButtonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left - 100),
      });
    }
    setShowComplaintTooltip(!showComplaintTooltip);
  };
  
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
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-600">Queixa principal</span>
              <span className="text-gray-400 text-xs">(anamnese.customerMainComplaint)</span>
              {hasComplaintVariants && (
                <>
                  <button
                    ref={complaintButtonRef}
                    onClick={handleComplaintTooltipClick}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Ver variantes da queixa"
                  >
                    <InfoIcon className="w-4 h-4" />
                  </button>
                  {showComplaintTooltip && createPortal(
                    <div 
                      ref={complaintTooltipRef}
                      className="fixed z-[9999] w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl"
                      style={{ top: tooltipPos.top, left: tooltipPos.left }}
                    >
                      <button 
                        onClick={() => setShowComplaintTooltip(false)}
                        className="absolute top-1 right-1 text-gray-400 hover:text-white p-1"
                      >
                        x
                      </button>
                      <div className="space-y-2">
                        {triage.anamnese?.customerMainComplaintQuestionVersion && (
                          <div>
                            <span className="text-gray-400 block mb-0.5">(customerMainComplaintQuestionVersion)</span>
                            <p className="text-white">{triage.anamnese.customerMainComplaintQuestionVersion}</p>
                          </div>
                        )}
                        {triage.anamnese?.customerMainComplaintProblemVersion && (
                          <div>
                            <span className="text-gray-400 block mb-0.5">(customerMainComplaintProblemVersion)</span>
                            <p className="text-white">{triage.anamnese.customerMainComplaintProblemVersion}</p>
                          </div>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </div>
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
