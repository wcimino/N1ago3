import { ReactNode } from "react";

interface StatItem {
  value: number;
  label: string;
  icon?: ReactNode;
  highlight?: boolean;
}

interface StatsBarProps {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className = "" }: StatsBarProps) {
  return (
    <div className={`grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs ${className}`}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 px-2 py-1.5 rounded-lg ${
            stat.highlight 
              ? "bg-amber-50 text-amber-700 border border-amber-200" 
              : "bg-gray-50 text-gray-600"
          }`}
        >
          {stat.icon && <span className="hidden sm:inline">{stat.icon}</span>}
          <span className="font-semibold text-sm sm:text-xs">{stat.value}</span>
          <span className="text-[10px] sm:text-xs truncate">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
