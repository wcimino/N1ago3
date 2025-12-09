interface StatsTableHeaderProps {
  colorScheme?: "orange" | "pink" | "blue" | "purple" | "violet" | "green" | "gray";
}

const badgeStyles = {
  orange: "bg-orange-100 text-orange-600",
  pink: "bg-pink-100 text-pink-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  violet: "bg-violet-100 text-violet-600",
  green: "bg-green-100 text-green-600",
  gray: "bg-gray-100 text-gray-600",
};

export function StatsTableHeader({ colorScheme = "gray" }: StatsTableHeaderProps) {
  const badgeColor = badgeStyles[colorScheme];
  
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 mb-1">
      <div className="flex-1" />
      <div className="flex items-center gap-3 shrink-0">
        <span title="Última hora" className={`min-w-[24px] flex justify-center text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>
          1h
        </span>
        <span title="Últimas 24 horas" className={`min-w-[24px] flex justify-center text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>
          24h
        </span>
        <div className="w-4" />
      </div>
    </div>
  );
}
