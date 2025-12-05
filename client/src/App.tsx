import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, CheckCircle, XCircle, Clock, Eye, ChevronLeft, ChevronRight, Users, Activity, UserCheck, UserX, ArrowDown } from "lucide-react";

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

function LogDetailModal({ logId, onClose }: { logId: number; onClose: () => void }) {
  const { data: log, isLoading } = useQuery<WebhookLogDetail>({
    queryKey: ["webhook-log", logId],
    queryFn: async () => {
      const res = await fetch(`/api/webhook-logs/${logId}`);
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

function EventsPage() {
  const [page, setPage] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const limit = 20;

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["webhook-stats"],
    queryFn: async () => {
      const res = await fetch("/api/webhook-logs/stats");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: logsData, isLoading } = useQuery<WebhookLogsResponse>({
    queryKey: ["webhook-logs", page],
    queryFn: async () => {
      const res = await fetch(`/api/webhook-logs?limit=${limit}&offset=${page * limit}`);
      return res.json();
    },
    refetchInterval: 5000,
  });

  const totalPages = logsData ? Math.ceil(logsData.total / limit) : 0;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total de Eventos</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Sucesso</p>
          <p className="text-3xl font-bold text-green-600">{stats?.by_status?.success || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Erro</p>
          <p className="text-3xl font-bold text-red-600">{stats?.by_status?.error || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pendente</p>
          <p className="text-3xl font-bold text-yellow-600">{stats?.by_status?.pending || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Eventos Recebidos</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : logsData?.logs.length === 0 ? (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recebido</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logsData?.logs.map((log) => (
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

function UsersPage() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: stats } = useQuery<UsersStatsResponse>({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const res = await fetch("/api/users/stats");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ["users", page],
    queryFn: async () => {
      const res = await fetch(`/api/users?limit=${limit}&offset=${page * limit}`);
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
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total de Usuários</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Autenticados</p>
          <p className="text-3xl font-bold text-green-600">{stats?.authenticated || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Anônimos</p>
          <p className="text-3xl font-bold text-gray-600">{stats?.anonymous || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : usersData?.users.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usersData?.users.map((user) => (
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
      </div>
    </>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<"users" | "events">("users");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">N1ago</h1>
          </div>
          <nav className="flex gap-1 -mb-px">
            <button
              onClick={() => setCurrentPage("users")}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                currentPage === "users"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Users className="w-4 h-4" />
              Usuários
            </button>
            <button
              onClick={() => setCurrentPage("events")}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                currentPage === "events"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Activity className="w-4 h-4" />
              Eventos
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {currentPage === "users" ? <UsersPage /> : <EventsPage />}
      </main>
    </div>
  );
}
