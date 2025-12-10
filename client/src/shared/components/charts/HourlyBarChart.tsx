interface HourlyDataPoint {
  hourStart: string;
  hour: number;
  date: string;
  count: number;
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

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  
  const now = new Date();
  const currentHour = now.getHours();
  const todayDate = now.toISOString().split('T')[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Últimas 24h por hora</span>
        <span className="text-sm font-semibold text-gray-900">{formatNumber(total)} total</span>
      </div>
      
      <div className="flex items-end gap-0.5 h-24">
        {data.map((point, idx) => {
          const heightPercent = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
          const isToday = point.date === todayDate;
          const isCurrentHour = isToday && point.hour === currentHour;
          
          let barColor = 'bg-gray-300';
          if (isCurrentHour) {
            barColor = 'bg-blue-500';
          } else if (isToday) {
            barColor = 'bg-blue-300';
          }
          
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center group relative"
            >
              <div
                className={`w-full rounded-t transition-all ${barColor} hover:opacity-80`}
                style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: '2px' }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {point.hour}h: {formatNumber(point.count)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{data[0]?.hour}h</span>
        <span>{data[data.length - 1]?.hour}h</span>
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
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-blue-500"></div>
          <span>Agora</span>
        </div>
      </div>
    </div>
  );
}
