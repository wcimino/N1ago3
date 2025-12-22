import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";
import type { OrchestratorLogEntry } from "./types";

export interface DemandFinderTooltipProps {
  logs?: OrchestratorLogEntry[] | null;
}

export function DemandFinderTooltip({ logs }: DemandFinderTooltipProps) {
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

  const demandFinderEntries = logs?.filter(entry => entry.agent === 'demand_finder') || [];
  
  if (demandFinderEntries.length === 0) return null;

  const handleClick = () => {
    if (!showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left - 200),
      });
    }
    setShowTooltip(!showTooltip);
  };
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
        title="Ver motivos do DemandFinder"
      >
        <InfoIcon className="w-3 h-3" />
      </button>
      {showTooltip && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl max-h-64 overflow-y-auto"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Motivos do DemandFinder</span>
            <button 
              onClick={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-white p-1"
            >
              ×
            </button>
          </div>
          <div className="space-y-2">
            {demandFinderEntries.map((entry, index) => (
              <div key={index} className="border-t border-gray-700 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400">{index + 1}ª rodada</span>
                  <span className="text-indigo-400">{entry.aiDecision || entry.action}</span>
                </div>
                {entry.aiReason ? (
                  <p className="text-gray-300 italic">{entry.aiReason}</p>
                ) : (
                  <p className="text-gray-500">Sem motivo registrado</p>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
