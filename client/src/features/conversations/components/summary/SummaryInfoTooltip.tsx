import { useState, useRef, useEffect, cloneElement, type ReactElement } from "react";
import { createPortal } from "react-dom";

export interface SummaryInfoTooltipProps {
  icon: ReactElement;
  iconColorClass: string;
  title: string;
  content: string | null | undefined;
  bgColorClass: string;
}

export function SummaryInfoTooltip({ 
  icon, 
  iconColorClass, 
  title, 
  content,
  bgColorClass 
}: SummaryInfoTooltipProps) {
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

  if (!content) return null;
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`ml-1 ${iconColorClass} hover:opacity-80 transition-opacity`}
        title={title}
      >
        {cloneElement(icon, { key: 'trigger' })}
      </button>
      {showTooltip && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={iconColorClass}>{cloneElement(icon, { key: 'tooltip' })}</span>
              <h5 className="font-medium text-gray-800 text-sm">{title}</h5>
            </div>
            <button 
              onClick={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ×
            </button>
          </div>
          <div className={`text-sm text-gray-700 leading-relaxed ${bgColorClass} p-3 rounded`}>
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
