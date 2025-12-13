import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface StatItem {
  value: number;
  label: string;
  icon?: ReactNode;
  highlight?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

interface StatsBarProps {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className = "" }: StatsBarProps) {
  return (
    <div className={`grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs ${className}`}>
      {stats.map((stat, index) => {
        const isClickable = !!stat.onClick && !stat.disabled && !stat.isLoading;
        const baseClasses = `flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 px-2 py-1.5 rounded-lg ${
          stat.highlight 
            ? "bg-amber-50 text-amber-700 border border-amber-200" 
            : "bg-gray-50 text-gray-600"
        }`;
        const clickableClasses = isClickable 
          ? "cursor-pointer hover:bg-gray-100 transition-colors" 
          : stat.disabled ? "opacity-50 cursor-not-allowed" : "";
        
        return (
          <div
            key={index}
            className={`${baseClasses} ${clickableClasses}`}
            onClick={isClickable ? stat.onClick : undefined}
            role={stat.onClick ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
          >
            {stat.isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : stat.icon ? (
              <span className="hidden sm:inline">{stat.icon}</span>
            ) : null}
            <span className="font-semibold text-sm sm:text-xs">{stat.value}</span>
            <span className="text-[10px] sm:text-xs truncate">{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
}
