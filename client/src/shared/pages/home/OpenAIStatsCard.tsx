import { REQUEST_TYPE_CONFIG, formatNumber } from "./config";
import type { OpenAIStatsResponse } from "./types";

interface OpenAIStatsCardProps {
  openaiStats: OpenAIStatsResponse | undefined;
}

export function OpenAIStatsCard({ openaiStats }: OpenAIStatsCardProps) {
  const stats = openaiStats?.last_24h;
  
  if (!stats) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }

  const MIN_PERCENT_THRESHOLD = 5;
  const breakdownRaw = (stats.breakdown || []).map(item => ({
    ...item,
    percentage: stats.estimated_cost > 0 
      ? (item.cost / stats.estimated_cost) * 100 
      : 0
  }));

  const mainItems = breakdownRaw.filter(item => item.percentage >= MIN_PERCENT_THRESHOLD);
  const otherItems = breakdownRaw.filter(item => item.percentage < MIN_PERCENT_THRESHOLD);
  
  const othersCost = otherItems.reduce((sum, item) => sum + item.cost, 0);
  const othersPercentage = otherItems.reduce((sum, item) => sum + item.percentage, 0);
  
  const displayItems = otherItems.length > 0 && othersPercentage > 0
    ? [...mainItems, { request_type: 'others', cost: othersCost, calls: 0, percentage: othersPercentage }]
    : mainItems;
  
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm text-gray-500">Custo (USD)</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">${stats.estimated_cost.toFixed(2)}</p>
      <div className="mt-4 pt-4 border-t border-gray-100 w-full grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Chamadas</p>
          <p className="text-lg font-semibold text-violet-600">{formatNumber(stats.total_calls)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tokens</p>
          <p className="text-lg font-semibold text-violet-600">{formatNumber(stats.total_tokens)}</p>
        </div>
      </div>
      {displayItems.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 w-full">
          <div className="h-7 w-full rounded-lg flex shadow-inner relative">
            {displayItems.map((item, index) => {
              const config = REQUEST_TYPE_CONFIG[item.request_type] || { 
                label: item.request_type === 'others' ? 'Outros' : item.request_type, 
                bg: 'bg-gray-400',
                text: 'text-gray-600'
              };
              const isFirst = index === 0;
              const isLast = index === displayItems.length - 1;
              
              return (
                <div 
                  key={item.request_type}
                  className={`h-full ${config.bg} flex items-center justify-center relative group cursor-pointer overflow-visible ${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
                  style={{ width: `${item.percentage}%` }}
                >
                  <span className="text-[10px] font-medium text-white whitespace-nowrap overflow-hidden px-0.5">
                    {item.percentage >= 15 ? `$${item.cost.toFixed(2)}` : ''}
                  </span>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg hidden group-hover:block whitespace-nowrap z-50">
                    {config.label}: ${item.cost.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {displayItems.map((item) => {
              const config = REQUEST_TYPE_CONFIG[item.request_type] || { 
                label: item.request_type === 'others' ? 'Outros' : item.request_type, 
                bg: 'bg-gray-400',
                text: 'text-gray-600'
              };
              return (
                <div key={item.request_type} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-sm ${config.bg}`} />
                  <span className="text-[10px] text-gray-500">
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
