import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, Activity, Package, AlertCircle, Heart, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { fetchApi } from "../../lib/queryClient";
import { DonutChart, HourlyBarChart, StatsCard, StatsTableHeader, StatsRow } from "../components";
import { useTimezone } from "../../contexts/TimezoneContext";
import type { UsersStatsResponse, StatsResponse, ProductStatsResponse, EmotionStatsResponse, ProblemStatsResponse } from "../../types";

interface OpenAIStatsResponse {
  last_24h: { 
    total_calls: number; 
    total_tokens: number; 
    estimated_cost: number;
    breakdown: Array<{ request_type: string; calls: number; cost: number }>;
  };
}

const REQUEST_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'response': { label: 'Sugestão', bg: 'bg-blue-500', text: 'text-blue-600' },
  'summary': { label: 'Resumo', bg: 'bg-emerald-500', text: 'text-emerald-600' },
  'classification': { label: 'Classificação', bg: 'bg-violet-500', text: 'text-violet-600' },
  'enrichment_agent': { label: 'Enriquecimento', bg: 'bg-amber-500', text: 'text-amber-600' },
  'learning': { label: 'Aprendizado', bg: 'bg-pink-500', text: 'text-pink-600' },
  'learning_agent': { label: 'Agente', bg: 'bg-indigo-500', text: 'text-indigo-600' },
  'embedding_generation': { label: 'Embeddings', bg: 'bg-gray-400', text: 'text-gray-600' },
};

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

interface ProductItem {
  product: string;
  productId: number | null;
  count: number;
}

function ProductsCard({ productStats }: { productStats: ProductStatsResponse | undefined }) {
  const lastHourItems = productStats?.last_hour?.items || [];
  const todayItems = productStats?.today?.items || [];
  
  // Create maps using a unique key that combines productId and product name
  const getKey = (p: ProductItem) => p.productId !== null ? `id:${p.productId}` : `name:${p.product}`;
  
  const lastHourMap = new Map(lastHourItems.map(p => [getKey(p), p]));
  const todayMap = new Map(todayItems.map(p => [getKey(p), p]));
  const allKeys = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
  
  // Sort by today count descending
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
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          {totalLastHour ? (
            <span className="font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalLastHour)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          {totalToday ? (
            <span className="font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalToday)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
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

function ProblemsCard({ problemStats }: { problemStats: ProblemStatsResponse | undefined }) {
  const lastHourItems = problemStats?.last_hour?.items || [];
  const todayItems = problemStats?.today?.items || [];
  const lastHourMap = new Map(lastHourItems.map(p => [p.problemName, p.count]));
  const todayMap = new Map(todayItems.map(p => [p.problemName, p.count]));
  const allProblems = [...new Set([...lastHourMap.keys(), ...todayMap.keys()])];
  
  allProblems.sort((a, b) => (todayMap.get(b) || 0) - (todayMap.get(a) || 0));
  
  if (allProblems.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nenhum problema identificado</p>;
  }
  
  const totalLastHour = problemStats?.last_hour?.total || 0;
  const totalToday = problemStats?.today?.total || 0;
  
  const top5Problems = allProblems.slice(0, 5);
  const othersProblems = allProblems.slice(5);
  
  const othersLastHour = othersProblems.reduce((sum, p) => sum + (lastHourMap.get(p) || 0), 0);
  const othersToday = othersProblems.reduce((sum, p) => sum + (todayMap.get(p) || 0), 0);
  const othersCount = othersProblems.length;
  
  return (
    <div>
      <StatsTableHeader colorScheme="purple" />
      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 bg-gray-50 -mx-5 px-5 rounded-t">
        <span className="text-sm font-bold text-gray-800">TOTAL</span>
        <div className="flex items-center gap-3 shrink-0">
          {totalLastHour ? (
            <span className="font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalLastHour)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          {totalToday ? (
            <span className="font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
              {formatNumber(totalToday)}
            </span>
          ) : (
            <span className="text-gray-300 text-xs min-w-[24px] text-center">-</span>
          )}
          <div className="w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {top5Problems.map((problem) => (
          <StatsRow
            key={problem}
            label={problem}
            lastHourValue={lastHourMap.get(problem)}
            todayValue={todayMap.get(problem)}
            colorScheme="purple"
            formatNumber={formatNumber}
          />
        ))}
        {othersCount > 0 && (
          <StatsRow
            label={`Outros (${othersCount})`}
            lastHourValue={othersLastHour || undefined}
            todayValue={othersToday || undefined}
            colorScheme="purple"
            formatNumber={formatNumber}
          />
        )}
      </div>
    </div>
  );
}

function OpenAIStatsCard({ openaiStats }: { openaiStats: OpenAIStatsResponse | undefined }) {
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

export function HomePage() {
  const { timezone } = useTimezone();
  
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

  const { data: problemStats } = useQuery<ProblemStatsResponse>({
    queryKey: ["problems-stats"],
    queryFn: () => fetchApi<ProblemStatsResponse>("/api/problems/stats"),
    refetchInterval: 30000,
  });

  const { data: openaiStats } = useQuery<OpenAIStatsResponse>({
    queryKey: ["openai-stats", timezone],
    queryFn: () => fetchApi<OpenAIStatsResponse>(`/api/openai/stats?timezone=${encodeURIComponent(timezone)}`),
    refetchInterval: 30000,
  });

  const { data: hourlyStats, isLoading: hourlyLoading } = useQuery<{ hour: number; isCurrentHour: boolean; isPast: boolean; todayCount: number; yesterdayCount: number }[]>({
    queryKey: ["hourly-stats", timezone],
    queryFn: () => fetchApi<{ hour: number; isCurrentHour: boolean; isPast: boolean; todayCount: number; yesterdayCount: number }[]>(`/api/conversations/hourly-stats?timezone=${encodeURIComponent(timezone)}`),
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-orange-600" />
            Produtos
          </h2>
          <ProductsCard productStats={productStats} />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-pink-600" />
            Sentimentos
          </h2>
          <EmotionsCard emotionStats={emotionStats} />
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-purple-600" />
            Problemas
          </h2>
          <ProblemsCard problemStats={problemStats} />
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
          title="Atendimentos por Hora"
          icon={<Clock className="w-4 h-4 text-cyan-600" />}
        >
          <HourlyBarChart data={hourlyStats || []} isLoading={hourlyLoading} />
        </StatsCard>

        <StatsCard
          title="Eventos"
          icon={<Activity className="w-4 h-4 text-purple-600" />}
          linkTo="/events"
          badge="24h"
        >
          <div className="flex flex-col items-center text-center">
            <p className="text-sm text-gray-500">Total de Eventos</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(eventsStats?.total || 0)}</p>
            <div className={`mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 ${(eventsStats?.by_status?.error || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{formatNumber(eventsStats?.by_status?.error || 0)} com erro</span>
            </div>
          </div>
        </StatsCard>

        <StatsCard
          title="OpenAI API"
          icon={<Sparkles className="w-4 h-4 text-violet-600" />}
          badge="24h"
        >
          <OpenAIStatsCard openaiStats={openaiStats} />
        </StatsCard>
      </div>
    </div>
  );
}
