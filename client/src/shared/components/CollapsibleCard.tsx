import { ChevronRight, ChevronDown, Plus, Minus } from "lucide-react";
import type { ReactNode } from "react";

interface CollapsibleCardProps {
  title: ReactNode;
  titlePrefix?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  hasChildren?: boolean;
  variant?: "card" | "nested";
  depth?: number;
  children?: ReactNode;
}

export function CollapsibleCard({
  title,
  titlePrefix,
  stats,
  actions,
  isExpanded,
  onToggle,
  hasChildren = true,
  variant = "card",
  depth = 0,
  children,
}: CollapsibleCardProps) {
  const isCard = variant === "card";
  const isNested = variant === "nested";
  
  const mobileIndent = depth * 12;
  const desktopIndent = depth * 20;

  return (
    <div className={isCard ? "mb-2" : ""}>
      <div 
        className={`
          group rounded-lg transition-colors
          ${isCard 
            ? "bg-white border border-gray-200 shadow-sm hover:shadow-md p-3 sm:p-4" 
            : "hover:bg-gray-50 py-2 px-2 sm:px-3"
          }
        `}
        style={{ 
          marginLeft: `max(${mobileIndent}px, min(${desktopIndent}px, calc(${mobileIndent}px + (${desktopIndent - mobileIndent}px) * ((100vw - 320px) / 400))))` 
        }}
      >
        <div 
          className={`flex items-start gap-2 sm:gap-3 ${hasChildren ? "cursor-pointer" : ""}`}
          onClick={() => hasChildren && onToggle()}
        >
          {hasChildren ? (
            <button 
              className="p-0.5 rounded hover:bg-gray-200 mt-0.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {isNested ? (
                isExpanded ? (
                  <Minus className="w-4 h-4 text-gray-500" />
                ) : (
                  <Plus className="w-4 h-4 text-gray-500" />
                )
              ) : (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )
              )}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`font-medium text-gray-900 break-words ${isCard ? "text-base" : "text-sm"}`}>
                {titlePrefix}
                {title}
              </span>
              {stats}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-1 shrink-0">
              {actions}
            </div>
          )}
        </div>

        {isExpanded && children && (
          <div className={isCard ? "mt-3 pt-3 border-t border-gray-100" : "mt-1"}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
