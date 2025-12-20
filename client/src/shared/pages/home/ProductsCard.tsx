import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { formatNumber } from "./config";
import type { DashboardProductItem, DashboardSubproductItem } from "../../../types";
import { Link } from "wouter";

interface ProductsCardProps {
  productStats24h: { items: DashboardProductItem[]; total: number } | undefined;
  productStats1h: { items: DashboardProductItem[]; total: number } | undefined;
}

export function ProductsCard({ productStats24h, productStats1h }: ProductsCardProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  
  const items24h = productStats24h?.items || [];
  const total24h = productStats24h?.total || 0;
  const total1h = productStats1h?.total || 0;
  
  const items1hMap = new Map((productStats1h?.items || []).map(i => [i.product, i]));
  
  if (items24h.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
  }
  
  const sortedItems = [...items24h].sort((a, b) => b.count - a.count);
  const top5 = sortedItems.slice(0, 5);
  const others = sortedItems.slice(5);
  const othersCount24h = others.reduce((sum, item) => sum + item.count, 0);
  const othersCount1h = others.reduce((sum, item) => sum + (items1hMap.get(item.product)?.count || 0), 0);

  const toggleExpand = (product: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(product)) {
        next.delete(product);
      } else {
        next.add(product);
      }
      return next;
    });
  };

  const getSubproducts1hMap = (product: string): Map<string, number> => {
    const item1h = items1hMap.get(product);
    if (!item1h?.subproducts) return new Map();
    return new Map(item1h.subproducts.map(s => [s.subproduct, s.count]));
  };

  const renderSubproducts = (subproducts: DashboardSubproductItem[], product: string) => {
    if (!subproducts || subproducts.length === 0) return null;
    
    const subproducts1hMap = getSubproducts1hMap(product);
    const sortedSubs = [...subproducts].sort((a, b) => b.count - a.count);
    const topSubs = sortedSubs.slice(0, 5);
    const otherSubs = sortedSubs.slice(5);
    const othersSubCount24h = otherSubs.reduce((sum, s) => sum + s.count, 0);
    const othersSubCount1h = otherSubs.reduce((sum, s) => sum + (subproducts1hMap.get(s.subproduct) || 0), 0);

    return (
      <div className="ml-5 border-l-2 border-gray-100 pl-3 py-1 space-y-0.5">
        {topSubs.map(sub => {
          const count1h = subproducts1hMap.get(sub.subproduct) || 0;
          return (
            <div key={sub.subproduct} className="flex items-center justify-between py-0.5 text-xs">
              <span className="text-gray-500 truncate flex-1">{sub.subproduct}</span>
              <div className="flex gap-3">
                <span className="text-gray-400 w-12 text-right">{count1h > 0 ? formatNumber(count1h) : '-'}</span>
                <span className="text-orange-400 w-12 text-right">{formatNumber(sub.count)}</span>
              </div>
            </div>
          );
        })}
        {otherSubs.length > 0 && (
          <div className="flex items-center justify-between py-0.5 text-xs text-gray-300">
            <span>Outros ({otherSubs.length})</span>
            <div className="flex gap-3">
              <span className="w-12 text-right">{othersSubCount1h > 0 ? formatNumber(othersSubCount1h) : '-'}</span>
              <span className="text-orange-300 w-12 text-right">{formatNumber(othersSubCount24h)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };
  
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
      <div className="space-y-0 mt-2">
        {top5.map((item) => {
          const count1h = items1hMap.get(item.product)?.count || 0;
          const linkTo = `/atendimentos?productStandard=${encodeURIComponent(item.product)}`;
          const hasSubproducts = item.subproducts && item.subproducts.length > 0;
          const isExpanded = expandedProducts.has(item.product);
          
          return (
            <div key={item.product}>
              <div className="flex items-center justify-between py-1 text-sm">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {hasSubproducts ? (
                    <button
                      onClick={() => toggleExpand(item.product)}
                      className="p-0.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors shrink-0"
                    >
                      {isExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="w-4.5" />
                  )}
                  <Link href={linkTo} className="text-gray-700 hover:text-orange-600 truncate">
                    {item.product}
                  </Link>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-500 w-12 text-right text-xs">{count1h > 0 ? formatNumber(count1h) : '-'}</span>
                  <span className="text-orange-600 w-12 text-right text-xs font-medium">{formatNumber(item.count)}</span>
                </div>
              </div>
              {isExpanded && hasSubproducts && renderSubproducts(item.subproducts!, item.product)}
            </div>
          );
        })}
        {others.length > 0 && (
          <div className="flex items-center justify-between py-1 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <span className="w-4.5" />
              <span>Outros ({others.length})</span>
            </div>
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
