interface StatsTotalRowProps {
  totalLastHour: number;
  totalToday: number;
  colorScheme: "orange" | "pink" | "blue" | "purple" | "violet" | "green";
  formatNumber: (num: number) => string;
}

const colorStyles = {
  orange: {
    border: "border-orange-200",
    bg: "bg-orange-50",
    textLabel: "text-orange-800",
    textValue: "text-orange-700",
  },
  pink: {
    border: "border-pink-200",
    bg: "bg-pink-50",
    textLabel: "text-pink-800",
    textValue: "text-pink-700",
  },
  blue: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    textLabel: "text-blue-800",
    textValue: "text-blue-700",
  },
  purple: {
    border: "border-purple-200",
    bg: "bg-purple-50",
    textLabel: "text-purple-800",
    textValue: "text-purple-700",
  },
  violet: {
    border: "border-violet-200",
    bg: "bg-violet-50",
    textLabel: "text-violet-800",
    textValue: "text-violet-700",
  },
  green: {
    border: "border-green-200",
    bg: "bg-green-50",
    textLabel: "text-green-800",
    textValue: "text-green-700",
  },
};

export function StatsTotalRow({ totalLastHour, totalToday, colorScheme, formatNumber }: StatsTotalRowProps) {
  const styles = colorStyles[colorScheme];
  
  return (
    <div className={`flex items-center justify-between py-2 border-b-2 ${styles.border} mb-2 ${styles.bg} -mx-5 px-5`}>
      <span className={`text-sm font-bold ${styles.textLabel}`}>TOTAL</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-bold ${styles.textValue} text-sm min-w-[24px] text-center`}>
          {totalLastHour ? formatNumber(totalLastHour) : '-'}
        </span>
        <span className={`font-bold ${styles.textValue} text-sm min-w-[24px] text-center`}>
          {totalToday ? formatNumber(totalToday) : '-'}
        </span>
        <div className="w-4" />
      </div>
    </div>
  );
}
