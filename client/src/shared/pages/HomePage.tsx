import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Activity, Package, AlertCircle, Heart, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { fetchApi } from "../../lib/queryClient";
import { DonutChart, HourlyBarChart, StatsCard } from "../components";
import { useTimezone } from "../../contexts/TimezoneContext";
import { ProductsCard, EmotionsCard, ProblemsCard, OpenAIStatsCard, formatNumber } from "./home";
import type { OpenAIStatsResponse } from "./home";
import type { StatsResponse, DashboardAnalyticsResponse } from "../../types";

export function HomePage() {
  const { timezone } = useTimezone();
  
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardAnalyticsResponse>({
    queryKey: ["dashboard-analytics", timezone],
    queryFn: () => fetchApi<DashboardAnalyticsResponse>(`/api/dashboard/analytics?period=last24Hours&timezone=${encodeURIComponent(timezone)}`),
    refetchInterval: 30000,
  });

  const { data: eventsStats } = useQuery<StatsResponse>({
    queryKey: ["webhook-stats"],
    queryFn: () => fetchApi<StatsResponse>("/api/webhook-logs/stats"),
    refetchInterval: 5000,
  });

  const { data: openaiStats } = useQuery<OpenAIStatsResponse>({
    queryKey: ["openai-stats", timezone],
    queryFn: () => fetchApi<OpenAIStatsResponse>(`/api/openai/stats?timezone=${encodeURIComponent(timezone)}`),
    refetchInterval: 30000,
  });

  const productStats = dashboardData ? { items: dashboardData.products.items, total: dashboardData.products.total } : undefined;
  const emotionStats = dashboardData ? { items: dashboardData.emotions.items, total: dashboardData.emotions.total } : undefined;
  const problemStats = dashboardData ? { items: dashboardData.problems.items, total: dashboardData.problems.total } : undefined;
  const usersStats = dashboardData?.users;
  const hourlyStats = dashboardData?.hourly;

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
          <HourlyBarChart data={hourlyStats || []} isLoading={dashboardLoading} />
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
