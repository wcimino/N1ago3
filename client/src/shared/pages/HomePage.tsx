import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, Activity, Package, AlertCircle, Heart, Sparkles, Coins, Hash, Clock, Calendar } from "lucide-react";
import { fetchApi } from "../../lib/queryClient";
import { DonutChart, StatsCard, StatsTableHeader, StatsRow } from "../components";
import type { UsersStatsResponse, StatsResponse, ProductStatsResponse, EmotionStatsResponse } from "../../types";

interface OpenAIStatsResponse {
  last_hour: { total_calls: number; total_tokens: number; estimated_cost: number };
  today: { total_calls: number; total_tokens: number; estimated_cost: number };
}

const emotionConfig: Record<number, { label: string; color: string; bgColor: string; emoji: string }> = {
  0: { label: "Sem classificação", color: "text-gray-400", bgColor: "bg-gray-100", emoji: "❓" },
  1: { label: "Muito positivo", color: "text-green-600", bgColor: "bg-green-50", emoji: "😊" },
  2: { label: "Positivo", color: "text-emerald-600", bgColor: "bg-emerald-50", emoji: "🙂" },
  3: { label: "Neutro", color: "text-gray-600", bgColor: "bg-gray-50", emoji: "😐" },
  4: { label: "Irritado", color: "text-orange-600", bgColor: "bg-orange-50", emoji: "😤" },
  5: { label: "Muito irritado", color: "text-red-600", bgColor: "bg-red-50", emoji: "😠" },
};

function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}

function ProductsCard({ productStats }: { productStats: ProductStatsResponse | undefined }) {
  const lastHourItems = productStats?.last_hour?.items || [];
  const todayItems = productStats?.today?.items || [];
  const lastHourMap = new Map(lastHourItems.map(p => [p.product, p.count]));
  const todayMap = new Map(todayItems.map(p => [p.product, p.count]));
  const allProducts = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
  
  allProducts.sort((a, b) => (todayMap.get(b) || 0) - (todayMap.get(a) || 0));
  
  if (allProducts.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum produto ainda</p>;
  }
  
  const totalLastHour = productStats?.last_hour?.total || 0;
  const totalToday = productStats?.today?.total || 0;
  
  return (
    <div>
      <StatsTableHeader colorScheme="orange" />
      <div className="flex items-center justify-between py-2 border-b-2 border-orange-200 mb-2 bg-orange-50 -mx-5 px-5">
        <span className="text-sm font-bold text-orange-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-orange-700 text-sm min-w-[24px] text-center">{totalLastHour ? formatNumber(totalLastHour) : '-'}</span>
          <span className="font-bold text-orange-700 text-sm min-w-[24px] text-center">{totalToday ? formatNumber(totalToday) : '-'}</span>
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {allProducts.map((product) => (
          <StatsRow
            key={product}
            label={product}
            lastHourValue={lastHourMap.get(product)}
            todayValue={todayMap.get(product)}
            linkTo={`/atendimentos?productStandard=${encodeURIComponent(product)}`}
            linkTitle={`Ver atendimentos de ${product}`}
            colorScheme="orange"
            formatNumber={formatNumber}
          />
        ))}
      </div>
    </div>
  );
}

function EmotionsCard({ emotionStats }: { emotionStats: EmotionStatsResponse | undefined }) {
  const lastHourItems = emotionStats?.last_hour?.items || [];
  const todayItems = emotionStats?.today?.items || [];
  const lastHourMap = new Map(lastHourItems.map(e => [e.emotionLevel, e.count]));
  const todayMap = new Map(todayItems.map(e => [e.emotionLevel, e.count]));
  const emotionLevels = [1, 2, 3, 4, 5, 0];
  
  const hasData = emotionLevels.some(level => lastHourMap.has(level) || todayMap.has(level));
  
  if (!hasData) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }
  
  const totalLastHour = emotionStats?.last_hour?.total || 0;
  const totalToday = emotionStats?.today?.total || 0;
  
  return (
    <div>
      <StatsTableHeader colorScheme="pink" />
      <div className="flex items-center justify-between py-2 border-b-2 border-pink-200 mb-2 bg-pink-50 -mx-5 px-5">
        <span className="text-sm font-bold text-pink-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-pink-700 text-sm min-w-[24px] text-center">{totalLastHour ? formatNumber(totalLastHour) : '-'}</span>
          <span className="font-bold text-pink-700 text-sm min-w-[24px] text-center">{totalToday ? formatNumber(totalToday) : '-'}</span>
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {emotionLevels.map((level) => {
          const config = emotionConfig[level];
          return (
            <StatsRow
              key={level}
              label={<>{config.emoji} {config.label}</>}
              lastHourValue={lastHourMap.get(level)}
              todayValue={todayMap.get(level)}
              linkTo={`/atendimentos?emotionLevel=${level}`}
              linkTitle={`Ver atendimentos com sentimento ${config.label}`}
              customValueColor={config.color}
              customValueBgColor={config.bgColor}
              formatNumber={formatNumber}
            />
          );
        })}
      </div>
    </div>
  );
}

function OpenAIStatsCard({ openaiStats }: { openaiStats: OpenAIStatsResponse | undefined }) {
  const lastHour = openaiStats?.last_hour;
  const today = openaiStats?.today;
  
  if (!lastHour && !today) {
    return <p className="text-sm text-gray-400 italic">Nenhum dado ainda</p>;
  }
  
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left pb-2"></th>
          <th className="text-right pb-2 w-24">
            <span title="Última hora" className="inline-flex justify-center w-full">
              <Clock className="w-3 h-3 text-violet-500" />
            </span>
          </th>
          <th className="text-right pb-2 w-24">
            <span title="Hoje" className="inline-flex justify-center w-full">
              <Calendar className="w-3 h-3 text-violet-500" />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="py-2">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm text-gray-700">Chamadas</span>
            </div>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              {formatNumber(lastHour?.total_calls || 0)}
            </span>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              {formatNumber(today?.total_calls || 0)}
            </span>
          </td>
        </tr>
        <tr>
          <td className="py-2">
            <div className="flex items-center gap-2">
              <span className="text-violet-500 text-xs font-bold w-3.5 text-center">TK</span>
              <span className="text-sm text-gray-700">Tokens</span>
            </div>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              {formatNumber(lastHour?.total_tokens || 0)}
            </span>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              {formatNumber(today?.total_tokens || 0)}
            </span>
          </td>
        </tr>
        <tr>
          <td className="py-2">
            <div className="flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-sm text-gray-700">Custo (USD)</span>
            </div>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              ${(lastHour?.estimated_cost || 0).toFixed(2)}
            </span>
          </td>
          <td className="py-2 text-right">
            <span className="font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">
              ${(today?.estimated_cost || 0).toFixed(2)}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
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

  const { data: openaiStats } = useQuery<OpenAIStatsResponse>({
    queryKey: ["openai-stats"],
    queryFn: () => fetchApi<OpenAIStatsResponse>("/api/openai/stats"),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-orange-600" />
            Produtos Mencionados
          </h2>
          <ProductsCard productStats={productStats} />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-pink-600" />
            Sentimento Atual
          </h2>
          <EmotionsCard emotionStats={emotionStats} />
        </div>

        <StatsCard
          title="Atendimentos"
          icon={<MessageCircle className="w-4 h-4 text-blue-600" />}
          linkTo="/conversations"
          badge="24h"
        >
          <DonutChart
            authenticated={usersStats?.authenticated || 0}
            anonymous={usersStats?.anonymous || 0}
            total={usersStats?.total || 0}
          />
        </StatsCard>

        <StatsCard
          title="Eventos"
          icon={<Activity className="w-4 h-4 text-purple-600" />}
          linkTo="/events"
          badge="24h"
        >
          <p className="text-sm text-gray-500">Total de Eventos</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(eventsStats?.total || 0)}</p>
          <div className={`mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 ${(eventsStats?.by_status?.error || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{formatNumber(eventsStats?.by_status?.error || 0)} com erro</span>
          </div>
        </StatsCard>

        <StatsCard
          title="OpenAI API"
          icon={<Sparkles className="w-4 h-4 text-violet-600" />}
        >
          <OpenAIStatsCard openaiStats={openaiStats} />
        </StatsCard>
      </div>
    </div>
  );
}
