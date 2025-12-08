import { Clock, Calendar } from "lucide-react";

interface StatsTableHeaderProps {
  colorScheme?: "orange" | "pink" | "blue" | "purple" | "violet" | "green" | "gray";
}

const colorStyles = {
  orange: "text-orange-500",
  pink: "text-pink-500",
  blue: "text-blue-500",
  purple: "text-purple-500",
  violet: "text-violet-500",
  green: "text-green-500",
  gray: "text-gray-500",
};

export function StatsTableHeader({ colorScheme = "gray" }: StatsTableHeaderProps) {
  const iconColor = colorStyles[colorScheme];
  
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 mb-1">
      <div className="flex-1" />
      <div className="flex items-center gap-3 shrink-0">
        <span title="Última hora" className="min-w-[24px] flex justify-center">
          <Clock className={`w-3 h-3 ${iconColor}`} />
        </span>
        <span title="Hoje" className="min-w-[24px] flex justify-center">
          <Calendar className={`w-3 h-3 ${iconColor}`} />
        </span>
        <div className="w-4" />
      </div>
    </div>
  );
}
