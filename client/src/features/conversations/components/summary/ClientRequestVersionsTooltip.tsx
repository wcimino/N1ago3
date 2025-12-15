import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";
import type { ClientRequestVersions } from "./types";

export interface ClientRequestVersionsTooltipProps {
  versions?: ClientRequestVersions | null;
}

export function ClientRequestVersionsTooltip({ versions }: ClientRequestVersionsTooltipProps) {
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
      const tooltipWidth = 320;
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = window.innerWidth - tooltipWidth - 16;
      }
      setTooltipPos({
        top: rect.bottom + 4,
        left,
      });
    }
    setShowTooltip(!showTooltip);
  };

  const hasVersions = versions && (
    versions.clientRequestStandardVersion || 
    versions.clientRequestQuestionVersion || 
    versions.clientRequestProblemVersion
  );
  
  if (!hasVersions) return null;
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="ml-1 text-blue-400 hover:text-blue-600 transition-colors"
        title="Ver versões alternativas"
      >
        <InfoIcon className="w-4 h-4" />
      </button>
      {showTooltip && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium text-gray-800 text-sm">Versões da Solicitação</h5>
            <button 
              onClick={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ×
            </button>
          </div>
          <div className="space-y-3">
            {versions?.clientRequestStandardVersion && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Narrativa (3ª pessoa)</div>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-2 rounded">
                  {versions.clientRequestStandardVersion}
                </p>
              </div>
            )}
            {versions?.clientRequestQuestionVersion && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Pergunta (1ª pessoa)</div>
                <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 p-2 rounded">
                  {versions.clientRequestQuestionVersion}
                </p>
              </div>
            )}
            {versions?.clientRequestProblemVersion && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Problema (infinitivo)</div>
                <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 p-2 rounded">
                  {versions.clientRequestProblemVersion}
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
