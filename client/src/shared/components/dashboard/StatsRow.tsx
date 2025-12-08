import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight as ArrowRight } from "lucide-react";

interface StatsRowProps {
  label: ReactNode;
  lastHourValue?: number;
  todayValue?: number;
  linkTo?: string;
  linkTitle?: string;
  colorScheme?: "orange" | "pink" | "blue" | "purple" | "violet" | "green" | "gray" | "emerald" | "red";
  customValueColor?: string;
  customValueBgColor?: string;
  formatNumber: (num: number) => string;
}

const colorStyles = {
  orange: { text: "text-orange-600", bg: "bg-orange-50" },
  pink: { text: "text-pink-600", bg: "bg-pink-50" },
  blue: { text: "text-blue-600", bg: "bg-blue-50" },
  purple: { text: "text-purple-600", bg: "bg-purple-50" },
  violet: { text: "text-violet-600", bg: "bg-violet-50" },
  green: { text: "text-green-600", bg: "bg-green-50" },
  gray: { text: "text-gray-600", bg: "bg-gray-50" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-50" },
  red: { text: "text-red-600", bg: "bg-red-50" },
};

export function StatsRow({
  label,
  lastHourValue,
  todayValue,
  linkTo,
  linkTitle,
  colorScheme = "gray",
  customValueColor,
  customValueBgColor,
  formatNumber,
}: StatsRowProps) {
  const styles = colorStyles[colorScheme];
  const valueColor = customValueColor || styles.text;
  const valueBgColor = customValueBgColor || styles.bg;
  
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <div className="min-w-0 flex-1 mr-2">
        <span className="text-sm text-gray-800 truncate block">{label}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {lastHourValue ? (
          <span className={`font-semibold ${valueColor} ${valueBgColor} px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center`}>
            {formatNumber(lastHourValue)}
          </span>
        ) : (
          <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
        )}
        {todayValue ? (
          <span className={`font-semibold ${valueColor} ${valueBgColor} px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center`}>
            {formatNumber(todayValue)}
          </span>
        ) : (
          <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
        )}
        {linkTo && (
          <Link
            href={linkTo}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title={linkTitle}
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        {!linkTo && <div className="w-4" />}
      </div>
    </div>
  );
}
