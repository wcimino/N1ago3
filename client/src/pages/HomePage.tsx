import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, MessageCircle, Activity, ChevronRight as ArrowRight, Package, Clock, Calendar } from "lucide-react";
import { fetchApi } from "../lib/queryClient";
import type { UsersStatsResponse, ConversationsStatsResponse, StatsResponse, ProductStatsResponse } from "../types";

export function HomePage() {
  const { data: usersStats } = useQuery<UsersStatsResponse>({
    queryKey: ["users-stats"],
    queryFn: () => fetchApi<UsersStatsResponse>("/api/users/stats"),
    refetchInterval: 5000,
  });

  const { data: conversationsStats } = useQuery<ConversationsStatsResponse>({
    queryKey: ["conversations-stats"],
    queryFn: () => fetchApi<ConversationsStatsResponse>("/api/conversations/stats"),
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
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Usuários
          </h2>
          <Link href="/users" className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total de Usuários</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{usersStats?.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Autenticados</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{usersStats?.authenticated || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Anônimos</p>
            <p className="text-4xl font-bold text-gray-600 mt-2">{usersStats?.anonymous || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-teal-600" />
            Conversas
          </h2>
          <Link href="/users" className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total de Conversas</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{conversationsStats?.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Ativas</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{conversationsStats?.active || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Fechadas</p>
            <p className="text-4xl font-bold text-gray-600 mt-2">{conversationsStats?.closed || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total de Mensagens</p>
            <p className="text-4xl font-bold text-teal-600 mt-2">{conversationsStats?.totalMessages || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Eventos
          </h2>
          <Link href="/events" className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total de Eventos</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{eventsStats?.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Sucesso</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{eventsStats?.by_status?.success || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Erro</p>
            <p className="text-4xl font-bold text-red-600 mt-2">{eventsStats?.by_status?.error || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Pendente</p>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{eventsStats?.by_status?.pending || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Produtos Mais Mencionados
          </h2>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <Clock className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-medium text-gray-700">Última Hora</p>
              </div>
              {productStats?.last_hour && productStats.last_hour.length > 0 ? (
                <ul className="space-y-2">
                  {productStats.last_hour.map((item, index) => (
                    <li key={item.product} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 w-4">{index + 1}.</span>
                        {item.product}
                      </span>
                      <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        {item.count}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum produto na última hora</p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <Calendar className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-medium text-gray-700">Hoje</p>
              </div>
              {productStats?.today && productStats.today.length > 0 ? (
                <ul className="space-y-2">
                  {productStats.today.map((item, index) => (
                    <li key={item.product} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 w-4">{index + 1}.</span>
                        {item.product}
                      </span>
                      <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        {item.count}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum produto hoje</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
