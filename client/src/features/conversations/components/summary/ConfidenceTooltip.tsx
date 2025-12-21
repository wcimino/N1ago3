import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";

export interface ConfidenceTooltipProps {
  confidence?: number | null;
  reason?: string | null;
}

export function ConfidenceTooltip({ confidence, reason }: ConfidenceTooltipProps) {
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
  
  const displayConfidence = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
  
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm text-gray-500">({displayConfidence}%)</span>
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
