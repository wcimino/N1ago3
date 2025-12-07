import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, Activity, ChevronRight as ArrowRight, Package, Clock, Calendar, AlertCircle } from "lucide-react";
import { fetchApi } from "../lib/queryClient";
import { DonutChart } from "../components/DonutChart";
import type { UsersStatsResponse, StatsResponse, ProductStatsResponse } from "../types";

function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}

export function HomePage() {
  const { data: usersStats } = useQuery<UsersStatsResponse>({
    queryKey: ["users-stats"],
    queryFn: () => fetchApi<UsersStatsResponse>("/api/users/stats"),
    refetchInterval: 5000,
  });

  const { data: eventsStats } = useQuery<StatsResponse>({
    queryKey: ["webhook-stats"],
    queryFn: () => fetchApi<StatsResponse>("/api/webhook-logs/stats"),
    refetchInterval: 5000,
  });

  const { data: productStats } = useQuery<ProductStatsResponse>({
    queryKey: ["products-stats"],
    queryFn: () => fetchApi<ProductStatsResponse>("/api/products/stats"),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600" />
              Produtos Mencionados
            </h2>
          </div>
          {(() => {
            const lastHourMap = new Map(productStats?.last_hour?.map(p => [p.product, p.count]) || []);
            const todayMap = new Map(productStats?.today?.map(p => [p.product, p.count]) || []);
            const allProducts = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
            
            if (allProducts.length === 0) {
              return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
            }
            
            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Produto</th>
                    <th className="text-center text-xs font-medium text-gray-500 pb-2 w-16">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-orange-500" />
                        1h
                      </span>
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 pb-2 w-16">
                      <span className="flex items-center justify-center gap-1">
                        <Calendar className="w-3 h-3 text-orange-500" />
                        24h
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts.map((product) => (
                    <tr key={product} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-800">{product}</td>
                      <td className="py-1.5 text-center">
                        {lastHourMap.get(product) ? (
                          <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs">
                            {lastHourMap.get(product)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-1.5 text-center">
                        {todayMap.get(product) ? (
                          <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs">
                            {todayMap.get(product)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              Atendimentos
              <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">24h</span>
            </h2>
            <Link href="/conversations" className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
              Ver <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <DonutChart
            authenticated={usersStats?.authenticated || 0}
            anonymous={usersStats?.anonymous || 0}
            total={usersStats?.total || 0}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              Eventos
              <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">24h</span>
            </h2>
            <Link href="/events" className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
              Ver <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-sm text-gray-500">Total de Eventos</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(eventsStats?.total || 0)}</p>
          <div className={`mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 ${(eventsStats?.by_status?.error || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{formatNumber(eventsStats?.by_status?.error || 0)} com erro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
