import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  colorScheme?: "default" | "purple" | "amber";
}

const colorSchemes = {
  default: {
    header: "text-gray-700",
    border: "border-gray-200",
    bg: "bg-gray-50",
    badge: "bg-gray-200 text-gray-600",
  },
  purple: {
    header: "text-purple-700",
    border: "border-purple-200",
    bg: "bg-purple-50",
    badge: "bg-purple-200 text-purple-700",
  },
  amber: {
    header: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    badge: "bg-amber-200 text-amber-700",
  },
};

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultExpanded = true,
  children,
  badge,
  colorScheme = "default",
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colors = colorSchemes[colorScheme];

  return (
    <div className={`border ${colors.border} rounded-lg overflow-hidden`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-2.5 ${colors.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className={`w-4 h-4 ${colors.header}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${colors.header}`} />
          )}
          {Icon && <Icon className={`w-4 h-4 ${colors.header}`} />}
          <span className={`text-sm font-medium ${colors.header}`}>{title}</span>
        </div>
        {badge !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
            {badge}
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}
