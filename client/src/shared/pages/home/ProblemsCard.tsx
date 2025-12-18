import { formatNumber } from "./config";
import type { DashboardProblemItem } from "../../../types";

interface ProblemsCardProps {
  problemStats24h: { items: DashboardProblemItem[]; total: number } | undefined;
  problemStats1h: { items: DashboardProblemItem[]; total: number } | undefined;
}

export function ProblemsCard({ problemStats24h, problemStats1h }: ProblemsCardProps) {
  const items24h = problemStats24h?.items || [];
  const total24h = problemStats24h?.total || 0;
  const total1h = problemStats1h?.total || 0;
  
  const items1hMap = new Map((problemStats1h?.items || []).map(i => [i.problemName, i.count]));
  
  if (items24h.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum problema identificado</p>;
  }
  
  const sortedItems = [...items24h].sort((a, b) => b.count - a.count);
  const top5 = sortedItems.slice(0, 5);
  const others = sortedItems.slice(5);
  const othersCount24h = others.reduce((sum, item) => sum + item.count, 0);
  const othersCount1h = others.reduce((sum, item) => sum + (items1hMap.get(item.problemName) || 0), 0);
  
  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-[10px] font-bold text-gray-500 uppercase">Problema</span>
        <div className="flex gap-3">
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">1h</span>
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">24h</span>
        </div>
      </div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-200 bg-purple-50 -mx-5 px-5">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex gap-3">
          <span className="font-bold text-purple-600 w-12 text-right text-sm">{formatNumber(total1h)}</span>
          <span className="font-bold text-purple-600 w-12 text-right text-sm">{formatNumber(total24h)}</span>
        </div>
      </div>
      <div className="space-y-1 mt-2">
        {top5.map((item) => {
          const count1h = items1hMap.get(item.problemName) || 0;
          return (
            <div key={item.problemName} className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-700 truncate flex-1">{item.problemName}</span>
              <div className="flex gap-3">
                <span className="text-gray-500 w-12 text-right text-xs">{count1h > 0 ? formatNumber(count1h) : '-'}</span>
                <span className="text-purple-600 w-12 text-right text-xs font-medium">{formatNumber(item.count)}</span>
              </div>
            </div>
          );
        })}
        {others.length > 0 && (
          <div className="flex items-center justify-between py-1 text-sm text-gray-400">
            <span>Outros ({others.length})</span>
            <div className="flex gap-3">
              <span className="w-12 text-right text-xs">{othersCount1h > 0 ? formatNumber(othersCount1h) : '-'}</span>
              <span className="text-purple-400 w-12 text-right text-xs">{formatNumber(othersCount24h)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
