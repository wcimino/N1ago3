interface DonutChartProps {
  authenticated: number;
  anonymous: number;
  total: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}

export function DonutChart({ authenticated, anonymous, total }: DonutChartProps) {
  const size = 140;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const authenticatedPercentage = total > 0 ? authenticated / total : 0;
  const authenticatedDash = circumference * authenticatedPercentage;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {total > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth={strokeWidth}
              strokeDasharray={`${authenticatedDash} ${circumference}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{formatNumber(total)}</span>
          <span className="text-xs text-gray-500">total</span>
        </div>
      </div>
      
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Autenticados</span>
          <span className="font-semibold text-gray-900">{formatNumber(authenticated)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
          <span className="text-gray-600">Anônimos</span>
          <span className="font-semibold text-gray-900">{formatNumber(anonymous)}</span>
        </div>
      </div>
    </div>
  );
}
