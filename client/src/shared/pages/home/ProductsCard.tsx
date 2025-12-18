import { formatNumber } from "./config";
import type { DashboardProductItem } from "../../../types";
import { Link } from "wouter";

interface ProductsCardProps {
  productStats: { items: DashboardProductItem[]; total: number } | undefined;
}

export function ProductsCard({ productStats }: ProductsCardProps) {
  const items = productStats?.items || [];
  const total = productStats?.total || 0;
  
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
  }
  
  const sortedItems = [...items].sort((a, b) => b.count - a.count);
  const top5 = sortedItems.slice(0, 5);
  const others = sortedItems.slice(5);
  const othersCount = others.reduce((sum, item) => sum + item.count, 0);
  
  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL (24h)</span>
        <span className="font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-xs">
          {formatNumber(total)}
        </span>
      </div>
      <div className="space-y-1 mt-2">
        {top5.map((item) => {
          const linkTo = item.productId !== null 
            ? `/atendimentos?productId=${item.productId}`
            : `/atendimentos?productStandard=${encodeURIComponent(item.product)}`;
          
          return (
            <div key={item.productId ?? item.product} className="flex items-center justify-between py-1 text-sm">
              <Link href={linkTo} className="text-gray-700 hover:text-orange-600 truncate">
                {item.product}
              </Link>
              <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs font-medium">
                {formatNumber(item.count)}
              </span>
            </div>
          );
        })}
        {others.length > 0 && (
          <div className="flex items-center justify-between py-1 text-sm text-gray-400">
            <span>Outros ({others.length})</span>
            <span className="text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded text-xs">
              {formatNumber(othersCount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
