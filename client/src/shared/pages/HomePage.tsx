import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, Activity, ChevronRight as ArrowRight, Package, Clock, Calendar, AlertCircle, Heart } from "lucide-react";
import { fetchApi } from "../../lib/queryClient";
import { DonutChart } from "../components";
import type { UsersStatsResponse, StatsResponse, ProductStatsResponse, EmotionStatsResponse } from "../../types";

const emotionConfig: Record<number, { label: string; color: string; bgColor: string; emoji: string }> = {
  1: { label: "Muito positivo", color: "text-green-600", bgColor: "bg-green-50", emoji: "😊" },
  2: { label: "Positivo", color: "text-emerald-600", bgColor: "bg-emerald-50", emoji: "🙂" },
  3: { label: "Neutro", color: "text-gray-600", bgColor: "bg-gray-50", emoji: "😐" },
  4: { label: "Irritado", color: "text-orange-600", bgColor: "bg-orange-50", emoji: "😤" },
  5: { label: "Muito irritado", color: "text-red-600", bgColor: "bg-red-50", emoji: "😠" },
};

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

  const { data: emotionStats } = useQuery<EmotionStatsResponse>({
    queryKey: ["emotions-stats"],
    queryFn: () => fetchApi<EmotionStatsResponse>("/api/emotions/stats"),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600" />
              Produtos Mencionados
            </h2>
            <div className="flex items-center gap-3">
              <span title="Última hora"><Clock className="w-3 h-3 text-orange-500" /></span>
              <span title="Hoje"><Calendar className="w-3 h-3 text-orange-500" /></span>
              <div className="w-4" />
            </div>
          </div>
          {(() => {
            const lastHourMap = new Map(productStats?.last_hour?.map(p => [p.product, p.count]) || []);
            const todayMap = new Map(productStats?.today?.map(p => [p.product, p.count]) || []);
            const allProducts = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
            
            allProducts.sort((a, b) => (todayMap.get(b) || 0) - (todayMap.get(a) || 0));
            
            if (allProducts.length === 0) {
              return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
            }
            
            return (
              <div className="space-y-1">
                {allProducts.map((product) => (
                  <div key={product} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 flex-1 mr-2">
                      <span className="text-sm text-gray-800 truncate block">{product}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {lastHourMap.get(product) ? (
                        <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
                          {lastHourMap.get(product)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
                      )}
                      {todayMap.get(product) ? (
                        <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
                          {todayMap.get(product)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
                      )}
                      <Link
                        href={`/atendimentos?productStandard=${encodeURIComponent(product)}`}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={`Ver atendimentos de ${product}`}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-600" />
              Sentimento Atual
            </h2>
            <div className="flex items-center gap-3">
              <span title="Última hora"><Clock className="w-3 h-3 text-pink-500" /></span>
              <span title="Hoje"><Calendar className="w-3 h-3 text-pink-500" /></span>
              <div className="w-4" />
            </div>
          </div>
          {(() => {
            const lastHourMap = new Map(emotionStats?.last_hour?.map(e => [e.emotionLevel, e.count]) || []);
            const todayMap = new Map(emotionStats?.today?.map(e => [e.emotionLevel, e.count]) || []);
            const emotionLevels = [1, 2, 3, 4, 5];
            
            const hasData = emotionLevels.some(level => lastHourMap.has(level) || todayMap.has(level));
            
            if (!hasData) {
              return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
            }
            
            return (
              <div className="space-y-1">
                {emotionLevels.map((level) => {
                  const config = emotionConfig[level];
                  return (
                    <div key={level} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-sm text-gray-800 truncate block">
                          {config.emoji} {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {lastHourMap.get(level) ? (
                          <span className={`font-semibold ${config.color} ${config.bgColor} px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center`}>
                            {lastHourMap.get(level)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
                        )}
                        {todayMap.get(level) ? (
                          <span className={`font-semibold ${config.color} ${config.bgColor} px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center`}>
                            {todayMap.get(level)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
                        )}
                        <Link
                          href={`/atendimentos?emotionLevel=${level}`}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title={`Ver atendimentos com sentimento ${config.label}`}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
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
