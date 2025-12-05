import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Route, Switch, Link, useLocation } from "wouter";
import { RefreshCw, CheckCircle, XCircle, Clock, Eye, ChevronLeft, ChevronRight, Users, Activity, UserCheck, UserX, ArrowDown, Home, ChevronRight as ArrowRight, LogOut, Shield, Plus, Trash2, LogIn, MessageCircle, Settings } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { apiRequest } from "./lib/queryClient";

interface WebhookLog {
  id: number;
  received_at: string;
  source_ip: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

interface WebhookLogDetail {
  id: number;
  received_at: string;
  source_ip: string;
  headers: Record<string, string>;
  payload: any;
  raw_body: string;
  processing_status: string;
  error_message: string | null;
  processed_at: string | null;
}

interface WebhookLogsResponse {
  total: number;
  offset: number;
  limit: number;
  logs: WebhookLog[];
}

interface StatsResponse {
  total: number;
  by_status: Record<string, number>;
}

interface UserProfile {
  email?: string;
  givenName?: string;
  surname?: string;
  locale?: string;
}

interface User {
  id: number;
  sunshine_id: string;
  external_id: string | null;
  authenticated: boolean;
  profile: UserProfile | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface UsersResponse {
  total: number;
  offset: number;
  limit: number;
  users: User[];
}

interface UsersStatsResponse {
  total: number;
  authenticated: number;
  anonymous: number;
}

interface ConversationsStatsResponse {
  total: number;
  active: number;
  closed: number;
  totalMessages: number;
}

interface AuthorizedUser {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface Conversation {
  id: number;
  zendesk_conversation_id: string;
  zendesk_app_id: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ConversationsResponse {
  total: number;
  offset: number;
  limit: number;
  conversations: Conversation[];
}

interface Message {
  id: number;
  author_type: string;
  author_name: string | null;
  content_type: string;
  content_text: string | null;
  received_at: string;
  zendesk_timestamp: string | null;
}

interface ConversationMessagesResponse {
  conversation_id: string;
  messages: Message[];
}

interface UserConversation {
  id: number;
  zendesk_conversation_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UserGroup {
  user_id: string;
  conversation_count: number;
  last_activity: string;
  first_activity: string;
  conversations: UserConversation[];
  user_info: {
    id: number;
    external_id: string | null;
    authenticated: boolean;
    profile: UserProfile | null;
  } | null;
}

interface GroupedConversationsResponse {
  total: number;
  offset: number;
  limit: number;
  user_groups: UserGroup[];
}

interface ConversationWithMessages {
  conversation: {
    id: number;
    zendesk_conversation_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  messages: Message[];
}

interface UserConversationsMessagesResponse {
  user_id: string;
  conversations: ConversationWithMessages[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
  };

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="w-3 h-3" />,
    error: <XCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {icons[status]}
      {status}
    </span>
  );
}

function AuthBadge({ authenticated }: { authenticated: boolean }) {
  return authenticated ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <UserCheck className="w-3 h-3" />
      Autenticado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <UserX className="w-3 h-3" />
      Anônimo
    </span>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">N1ago</h1>
        
        <a
          href="/api/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Entrar
        </a>
      </div>
    </div>
  );
}

function UnauthorizedPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <a
          href="/api/logout"
          className="inline-flex items-center justify-center gap-2 w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair e tentar com outra conta
        </a>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  );
}

function LogDetailModal({ logId, onClose }: { logId: number; onClose: () => void }) {
  const { data: log, isLoading } = useQuery<WebhookLogDetail>({
    queryKey: ["webhook-log", logId],
    queryFn: async () => {
      const res = await fetch(`/api/webhook-logs/${logId}`, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Log #{logId}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : log ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <StatusBadge status={log.processing_status} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP de Origem</label>
                  <p className="mt-1 text-sm">{log.source_ip}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Recebido em</label>
                  <p className="mt-1 text-sm">
                    {format(new Date(log.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Processado em</label>
                  <p className="mt-1 text-sm">
                    {log.processed_at
                      ? format(new Date(log.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                      : "-"}
                  </p>
                </div>
              </div>

              {log.error_message && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Erro</label>
                  <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{log.error_message}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500">Headers</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(log.headers, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Payload</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Log não encontrado</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage() {
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
          <Link href="/conversation" className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
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

function EventsPage() {
  const [page, setPage] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const limit = 20;

  const urlParams = new URLSearchParams(window.location.search);
  const userFilter = urlParams.get("user");

  const { data: logsData, isLoading } = useQuery<WebhookLogsResponse>({
    queryKey: ["webhook-logs", page, userFilter],
    queryFn: async () => {
      let url = `/api/webhook-logs?limit=${limit}&offset=${page * limit}`;
      if (userFilter) {
        url += `&user=${encodeURIComponent(userFilter)}`;
      }
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const totalPages = logsData ? Math.ceil(logsData.total / limit) : 0;

  const clearFilter = () => {
    navigate("/events");
    setPage(0);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Eventos Recebidos</h2>
          {userFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filtrado por usuário:</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {userFilter.slice(0, 12)}...
                <button onClick={clearFilter} className="ml-1 hover:text-blue-600">
                  &times;
                </button>
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !logsData?.logs || logsData.logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhum evento recebido ainda.</p>
            <p className="text-sm mt-1">Configure o webhook no Zendesk para começar a receber eventos.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <span className="inline-flex items-center gap-1">
                        Recebido
                        <ArrowDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logsData.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">#{log.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(new Date(log.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{log.source_ip}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.processing_status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-red-500 max-w-xs truncate">
                        {log.error_message || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLogId(log.id)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, logsData?.total || 0)} de{" "}
                {logsData?.total || 0}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedLogId !== null && (
        <LogDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
      )}
    </>
  );
}

function UserDetailModal({ user, onClose }: { user: User; onClose: () => void }) {
  const getUserDisplayName = (u: User) => {
    if (u.profile?.givenName || u.profile?.surname) {
      return `${u.profile?.givenName || ""} ${u.profile?.surname || ""}`.trim();
    }
    return null;
  };

  const displayName = getUserDisplayName(user);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-start bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {displayName || `Usuário #${user.id}`}
              </h2>
              <p className="text-sm text-gray-500">{user.profile?.email || user.sunshine_id.slice(0, 20) + "..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AuthBadge authenticated={user.authenticated} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>
        
        <div className="p-5 overflow-auto max-h-[calc(90vh-100px)]">
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Informações Pessoais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Nome</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{displayName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{user.profile?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Idioma</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{user.profile?.locale || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">External ID</p>
                  <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{user.external_id || "-"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Atividade</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Primeira interação</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {format(new Date(user.first_seen_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Última interação</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {format(new Date(user.last_seen_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Identificadores</h3>
              <div>
                <p className="text-xs text-gray-500 uppercase">Sunshine ID</p>
                <p className="text-sm font-mono bg-gray-50 p-2 rounded mt-1 break-all text-gray-700">{user.sunshine_id}</p>
              </div>
            </div>

            {user.profile && Object.keys(user.profile).length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dados do Perfil (JSON)</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-32 text-gray-700">
                  {JSON.stringify(user.profile, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersPage() {
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const limit = 20;

  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ["users", page],
    queryFn: async () => {
      const res = await fetch(`/api/users?limit=${limit}&offset=${page * limit}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const totalPages = usersData ? Math.ceil(usersData.total / limit) : 0;

  const getUserDisplayName = (user: User) => {
    if (user.profile?.givenName || user.profile?.surname) {
      return `${user.profile?.givenName || ""} ${user.profile?.surname || ""}`.trim();
    }
    return user.sunshine_id.slice(0, 12) + "...";
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !usersData?.users || usersData.users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Nenhum usuário registrado ainda.</p>
          <p className="text-sm mt-1">Os usuários serão criados automaticamente quando eventos chegarem.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primeira vez</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <span className="inline-flex items-center gap-1">
                      Última vez
                      <ArrowDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usersData.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">#{user.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getUserDisplayName(user)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.profile?.email || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <AuthBadge authenticated={user.authenticated} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(user.first_seen_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(user.last_seen_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                        <Link
                          href={`/events?user=${encodeURIComponent(user.sunshine_id)}`}
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm"
                        >
                          <Activity className="w-4 h-4" />
                          Eventos
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, usersData?.total || 0)} de{" "}
              {usersData?.total || 0}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUser !== null && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

function ConversationsPage() {
  const [page, setPage] = useState(0);
  const [, navigate] = useLocation();
  const limit = 20;

  const { data: groupedData, isLoading } = useQuery<GroupedConversationsResponse>({
    queryKey: ["conversations-grouped", page],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/grouped?limit=${limit}&offset=${page * limit}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const totalPages = groupedData ? Math.ceil(groupedData.total / limit) : 0;

  const getUserDisplayName = (group: UserGroup) => {
    if (group.user_info?.profile) {
      const profile = group.user_info.profile as UserProfile;
      if (profile.givenName || profile.surname) {
        return `${profile.givenName || ""} ${profile.surname || ""}`.trim();
      }
      if (profile.email) {
        return profile.email;
      }
    }
    return group.user_id.slice(0, 16) + "...";
  };

  const getActiveCount = (conversations: UserConversation[]) => {
    return conversations.filter(c => c.status === "active").length;
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        <p className="text-sm text-gray-500 mt-1">Lista de usuários com suas conversas e eventos</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !groupedData?.user_groups || groupedData.user_groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>Nenhuma conversa registrada ainda.</p>
          <p className="text-sm mt-1">As conversas serão criadas quando mensagens chegarem via webhook.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {groupedData.user_groups.map((group) => (
              <div key={group.user_id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{getUserDisplayName(group)}</h3>
                        {group.user_info?.authenticated && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <UserCheck className="w-3 h-3" />
                            Autenticado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          {group.conversation_count} {group.conversation_count === 1 ? "conversa" : "conversas"}
                        </span>
                        {getActiveCount(group.conversations) > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {getActiveCount(group.conversations)} ativa{getActiveCount(group.conversations) > 1 ? "s" : ""}
                          </span>
                        )}
                        <span>
                          Última atividade: {format(new Date(group.last_activity), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events?user=${encodeURIComponent(group.user_id)}`}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <Activity className="w-4 h-4" />
                      Ver Eventos
                    </Link>
                    <button
                      onClick={() => navigate(`/conversation/user/${encodeURIComponent(group.user_id)}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Ver Conversa
                    </button>
                  </div>
                </div>
                
                {group.conversations.length > 1 && (
                  <div className="mt-3 ml-14 flex flex-wrap gap-2">
                    {group.conversations.map((conv, idx) => (
                      <span
                        key={conv.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          conv.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        #{idx + 1} - {format(new Date(conv.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, groupedData?.total || 0)} de{" "}
              {groupedData?.total || 0} usuários
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserConversationsPage({ params }: { params: { userId: string } }) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);

  const { data, isLoading, error } = useQuery<UserConversationsMessagesResponse>({
    queryKey: ["user-conversations-messages", userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/user/${encodeURIComponent(userId)}/messages`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Conversas não encontradas");
      }
      return res.json();
    },
  });

  const getAuthorColor = (authorType: string) => {
    switch (authorType) {
      case "user":
        return "bg-blue-500";
      case "business":
      case "app":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const isUserMessage = (authorType: string) => {
    return authorType === "user";
  };

  const totalMessages = data?.conversations.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="bg-white rounded-t-lg shadow-sm border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/conversation")}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Histórico do Usuário</h2>
          <p className="text-xs text-gray-500">
            {data?.conversations.length || 0} {(data?.conversations.length || 0) === 1 ? "conversa" : "conversas"} - {totalMessages} {totalMessages === 1 ? "mensagem" : "mensagens"}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <XCircle className="w-12 h-12 text-red-300 mb-3" />
            <p>Conversas não encontradas</p>
            <button
              onClick={() => navigate("/conversation")}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Voltar para lista
            </button>
          </div>
        ) : !data?.conversations || data.conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p>Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {data.conversations.map((convItem, convIndex) => (
              <div key={convItem.conversation.id}>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Conversa #{convIndex + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(convItem.conversation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      convItem.conversation.status === "active" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {convItem.conversation.status}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                <div className="space-y-3">
                  {convItem.messages.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Nenhuma mensagem nesta conversa
                    </div>
                  ) : (
                    convItem.messages.map((msg: Message) => {
                      const isUser = isUserMessage(msg.author_type);
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[75%] ${
                              isUser
                                ? "bg-white rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl"
                                : "bg-green-100 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl"
                            } shadow-sm px-4 py-2`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`w-2 h-2 rounded-full ${getAuthorColor(msg.author_type)}`}
                              />
                              <span className="text-xs font-medium text-gray-700">
                                {msg.author_name || msg.author_type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                              {msg.content_text || `[${msg.content_type}]`}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1 text-right">
                              {format(
                                new Date(msg.zendesk_timestamp || msg.received_at),
                                "dd/MM/yyyy HH:mm",
                                { locale: ptBR }
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuthorizedUsersPage() {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data: authorizedUsers, isLoading } = useQuery<AuthorizedUser[]>({
    queryKey: ["authorized-users"],
    queryFn: async () => {
      const res = await fetch("/api/authorized-users", { credentials: "include" });
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const res = await apiRequest("POST", "/api/authorized-users", { email, name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
      setNewEmail("");
      setNewName("");
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao adicionar usuário");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/authorized-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!newEmail.toLowerCase().endsWith("@ifood.com.br")) {
      setError("Email deve ser do domínio @ifood.com.br");
      return;
    }
    
    addMutation.mutate({ email: newEmail, name: newName });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Adicionar Usuário Autorizado
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="usuario@ifood.com.br"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do usuário"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Adicionar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Usuários Autorizados</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !authorizedUsers || authorizedUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhum usuário autorizado cadastrado.</p>
            <p className="text-sm mt-1">Adicione usuários usando o formulário acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adicionado em</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adicionado por</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {authorizedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.createdBy || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeMutation.mutate(user.id)}
                        disabled={removeMutation.isPending}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}

function EnvironmentBadge() {
  const isDev = import.meta.env.DEV;
  
  return (
    <div className={`fixed top-0 right-0 z-50 px-3 py-1 text-xs font-bold uppercase tracking-wide ${
      isDev 
        ? "bg-yellow-500 text-yellow-900" 
        : "bg-green-500 text-white"
    }`}>
      {isDev ? "Ambiente de Desenvolvimento" : "Ambiente de Produção"}
    </div>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <EnvironmentBadge />
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-gray-700">
              N1ago
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.email}
              </span>
              <Link
                href="/authorized-users"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <a
                href="/api/logout"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </a>
            </div>
          </div>
          <nav className="flex gap-1 -mb-px">
            <NavLink href="/">
              <Home className="w-4 h-4" />
              Home
            </NavLink>
            <NavLink href="/conversation">
              <Users className="w-4 h-4" />
              Usuários
            </NavLink>
            <NavLink href="/events">
              <Activity className="w-4 h-4" />
              Eventos
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/events" component={EventsPage} />
          <Route path="/conversation" component={ConversationsPage} />
          <Route path="/conversation/user/:userId">{(params) => <UserConversationsPage params={params} />}</Route>
          <Route path="/authorized-users" component={AuthorizedUsersPage} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  const { user, isLoading, isUnauthorized, unauthorizedMessage } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (isUnauthorized) {
    return <UnauthorizedPage message={unauthorizedMessage || "Você não tem permissão para acessar esta aplicação"} />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}
