import { formatNumber } from "./config";
import type { DashboardProductItem } from "../../../types";
import { Link } from "wouter";

interface ProductsCardProps {
  productStats24h: { items: DashboardProductItem[]; total: number } | undefined;
  productStats1h: { items: DashboardProductItem[]; total: number } | undefined;
}

export function ProductsCard({ productStats24h, productStats1h }: ProductsCardProps) {
  const items24h = productStats24h?.items || [];
  const total24h = productStats24h?.total || 0;
  const total1h = productStats1h?.total || 0;
  
  const items1hMap = new Map((productStats1h?.items || []).map(i => [i.productId ?? i.product, i.count]));
  
  if (items24h.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
  }
  
  const sortedItems = [...items24h].sort((a, b) => b.count - a.count);
  const top5 = sortedItems.slice(0, 5);
  const others = sortedItems.slice(5);
  const othersCount24h = others.reduce((sum, item) => sum + item.count, 0);
  const othersCount1h = others.reduce((sum, item) => sum + (items1hMap.get(item.productId ?? item.product) || 0), 0);
  
  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-[10px] font-bold text-gray-500 uppercase">Produto</span>
        <div className="flex gap-3">
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">1h</span>
          <span className="text-[10px] font-bold text-gray-500 w-12 text-right">24h</span>
        </div>
      </div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-200 bg-orange-50 -mx-5 px-5">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex gap-3">
          <span className="font-bold text-orange-600 w-12 text-right text-sm">{formatNumber(total1h)}</span>
          <span className="font-bold text-orange-600 w-12 text-right text-sm">{formatNumber(total24h)}</span>
        </div>
      </div>
      <div className="space-y-1 mt-2">
        {top5.map((item) => {
          const key = item.productId ?? item.product;
          const count1h = items1hMap.get(key) || 0;
          const linkTo = item.productId !== null 
            ? `/atendimentos?productId=${item.productId}`
            : `/atendimentos?productStandard=${encodeURIComponent(item.product)}`;
          
          return (
            <div key={key} className="flex items-center justify-between py-1 text-sm">
              <Link href={linkTo} className="text-gray-700 hover:text-orange-600 truncate flex-1">
                {item.product}
              </Link>
              <div className="flex gap-3">
                <span className="text-gray-500 w-12 text-right text-xs">{count1h > 0 ? formatNumber(count1h) : '-'}</span>
                <span className="text-orange-600 w-12 text-right text-xs font-medium">{formatNumber(item.count)}</span>
              </div>
            </div>
          );
        })}
        {others.length > 0 && (
          <div className="flex items-center justify-between py-1 text-sm text-gray-400">
            <span>Outros ({others.length})</span>
            <div className="flex gap-3">
              <span className="w-12 text-right text-xs">{othersCount1h > 0 ? formatNumber(othersCount1h) : '-'}</span>
              <span className="text-orange-400 w-12 text-right text-xs">{formatNumber(othersCount24h)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
