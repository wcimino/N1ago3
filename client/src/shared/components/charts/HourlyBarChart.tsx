interface HourlyDataPoint {
  hour: number;
  isCurrentHour: boolean;
  isPast: boolean;
  todayCount: number;
  yesterdayCount: number;
}

interface HourlyBarChartProps {
  data: HourlyDataPoint[];
  isLoading?: boolean;
}

function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}

export function HourlyBarChart({ data, isLoading }: HourlyBarChartProps) {
  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-sm text-gray-400">Carregando...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-sm text-gray-400 italic">Nenhum dado ainda</span>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => Math.max(d.todayCount, d.yesterdayCount)), 1);
  const todayTotal = data.reduce((sum, d) => sum + d.todayCount, 0);
  const yesterdayTotal = data.reduce((sum, d) => sum + d.yesterdayCount, 0);

  const chartHeight = 80;

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-center gap-4">
        <span className="text-sm font-semibold text-gray-900">Hoje: {formatNumber(todayTotal)}</span>
        <span className="text-sm text-gray-500">Ontem: {formatNumber(yesterdayTotal)}</span>
      </div>
      
      <div className="flex items-end gap-px w-full" style={{ height: `${chartHeight}px` }}>
        {data.map((point) => {
          const todayBarHeight = maxCount > 0 ? (point.todayCount / maxCount) * chartHeight : 0;
          const yesterdayBarHeight = maxCount > 0 ? (point.yesterdayCount / maxCount) * chartHeight : 0;
          
          let todayBarColor = 'bg-blue-300';
          if (point.isCurrentHour) {
            todayBarColor = 'bg-blue-500';
          } else if (!point.isPast) {
            todayBarColor = 'bg-blue-100';
          }
          
          return (
            <div
              key={point.hour}
              className="flex-1 flex flex-col justify-end items-center group relative"
            >
              <div className="flex items-end gap-[1px] w-full h-full">
                <div
                  className="flex-1 bg-gray-300 rounded-t transition-all hover:opacity-80"
                  style={{ height: `${Math.max(yesterdayBarHeight, 2)}px` }}
                />
                <div
                  className={`flex-1 rounded-t transition-all ${todayBarColor} hover:opacity-80`}
                  style={{ height: `${Math.max(todayBarHeight, 2)}px` }}
                />
              </div>
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  <div>{point.hour}h</div>
                  <div>Hoje: {formatNumber(point.todayCount)}</div>
                  <div>Ontem: {formatNumber(point.yesterdayCount)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0h</span>
        <span>23h</span>
      </div>
      
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-gray-300"></div>
          <span>Ontem</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-blue-300"></div>
          <span>Hoje</span>
        </div>
      </div>
    </div>
  );
}
