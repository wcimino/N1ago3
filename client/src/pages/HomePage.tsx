import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, MessageCircle, Activity, ChevronRight as ArrowRight } from "lucide-react";
import type { UsersStatsResponse, ConversationsStatsResponse, StatsResponse } from "../types";

export function HomePage() {
  const { data: usersStats } = useQuery<UsersStatsResponse>({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const res = await fetch("/api/users/stats", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: conversationsStats } = useQuery<ConversationsStatsResponse>({
    queryKey: ["conversations-stats"],
    queryFn: async () => {
      const res = await fetch("/api/conversations/stats", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: eventsStats } = useQuery<StatsResponse>({
    queryKey: ["webhook-stats"],
    queryFn: async () => {
      const res = await fetch("/api/webhook-logs/stats", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
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
    </div>
  );
}
