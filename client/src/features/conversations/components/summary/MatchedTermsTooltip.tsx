import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";

export interface MatchedTermsTooltipProps {
  matchedTerms?: string[] | null;
  bgColor?: string;
  textColor?: string;
}

export function MatchedTermsTooltip({ matchedTerms, bgColor = "bg-cyan-100", textColor = "text-cyan-600" }: MatchedTermsTooltipProps) {
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
