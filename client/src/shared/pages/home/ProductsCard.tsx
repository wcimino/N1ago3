import { StatsTableHeader, StatsRow } from "../../components";
import { formatNumber } from "./config";
import type { ProductStatsResponse } from "../../../types";
import type { ProductItem } from "./types";

interface ProductsCardProps {
  productStats: ProductStatsResponse | undefined;
}

export function ProductsCard({ productStats }: ProductsCardProps) {
  const lastHourItems = productStats?.last_hour?.items || [];
  const todayItems = productStats?.today?.items || [];
  
  const getKey = (p: ProductItem) => p.productId !== null ? `id:${p.productId}` : `name:${p.product}`;
  
  const lastHourMap = new Map(lastHourItems.map(p => [getKey(p), p]));
  const todayMap = new Map(todayItems.map(p => [getKey(p), p]));
  const allKeys = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
  
  allKeys.sort((a, b) => (todayMap.get(b)?.count || 0) - (todayMap.get(a)?.count || 0));
  
  if (allKeys.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
  }
  
  const totalLastHour = productStats?.last_hour?.total || 0;
  const totalToday = productStats?.today?.total || 0;
  
  const top5Keys = allKeys.slice(0, 5);
  const othersKeys = allKeys.slice(5);
  
  const othersLastHour = othersKeys.reduce((sum, key) => sum + (lastHourMap.get(key)?.count || 0), 0);
  const othersToday = othersKeys.reduce((sum, key) => sum + (todayMap.get(key)?.count || 0), 0);
  const othersCount = othersKeys.length;
  
  return (
    <div>
      <StatsTableHeader colorScheme="orange" />
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          {totalLastHour ? (
            <span className="font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalLastHour)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          {totalToday ? (
            <span className="font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalToday)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {top5Keys.map((key) => {
          const item = todayMap.get(key) || lastHourMap.get(key);
          if (!item) return null;
          
          const linkTo = item.productId !== null 
            ? `/atendimentos?productId=${item.productId}`
            : `/atendimentos?productStandard=${encodeURIComponent(item.product)}`;
          
          return (
            <StatsRow
              key={key}
              label={item.product}
              lastHourValue={lastHourMap.get(key)?.count}
              todayValue={todayMap.get(key)?.count}
              linkTo={linkTo}
              linkTitle={`Ver atendimentos de ${item.product}`}
              colorScheme="orange"
              formatNumber={formatNumber}
            />
          );
        })}
        {othersCount > 0 && (
          <StatsRow
            label={`Outros (${othersCount})`}
            lastHourValue={othersLastHour || undefined}
            todayValue={othersToday || undefined}
            colorScheme="orange"
            formatNumber={formatNumber}
          />
        )}
      </div>
    </div>
  );
}
