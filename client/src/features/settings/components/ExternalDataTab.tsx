import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Database, Users, RefreshCw, ArrowRight, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";

interface SyncStatus {
  isSyncing: boolean;
  currentSyncId: number | null;
  lastSync: {
    id: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
  } | null;
  totalUsers: number;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}min ${seconds}s`;
}

export function ExternalDataTab() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { formatShortDateTime } = useDateFormatters();
  const [maxUsers, setMaxUsers] = useState<string>("1000");

  const { data: syncStatus, isLoading, refetch } = useQuery<SyncStatus>({
    queryKey: ["zendesk-users-sync-status"],
    queryFn: () => fetchApi<SyncStatus>("/api/external-data/zendesk-users/sync-status"),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isSyncing ? 2000 : false;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (limit?: number) => {
      const body = limit ? { maxUsers: limit } : {};
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/sync", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
    },
  });

  const handleSync = () => {
    const limit = maxUsers ? parseInt(maxUsers, 10) : undefined;
    syncMutation.mutate(limit);
    setTimeout(() => refetch(), 500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "in_progress":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluída";
      case "failed":
        return "Falhou";
      case "in_progress":
        return "Em andamento";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Usuários Zendesk</h3>
              <p className="text-sm text-gray-600">
                Sincronize usuários do Zendesk Support para acesso local
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-2xl font-bold text-gray-900">
                {syncStatus?.totalUsers.toLocaleString("pt-BR") ?? 0}
              </div>
              <div className="text-xs text-gray-500">Usuários sincronizados</div>
            </div>

            {syncStatus?.lastSync && (
              <>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(syncStatus.isSyncing ? "in_progress" : syncStatus.lastSync.status)}
                    <span className="text-sm font-medium text-gray-900">
                      {syncStatus.isSyncing ? "Em andamento" : getStatusText(syncStatus.lastSync.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">Status</div>
                </div>

                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-sm font-medium text-gray-900">
                    {formatShortDateTime(syncStatus.lastSync.startedAt)}
                  </div>
                  <div className="text-xs text-gray-500">Última sincronização</div>
                </div>

                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-sm font-medium text-gray-900">
                    {formatDuration(syncStatus.lastSync.durationMs)}
                  </div>
                  <div className="text-xs text-gray-500">Duração</div>
                </div>
              </>
            )}
          </div>

          {syncStatus?.lastSync && syncStatus.lastSync.status === "completed" && (
            <div className="text-xs text-gray-500">
              {syncStatus.lastSync.recordsProcessed.toLocaleString("pt-BR")} processados, {" "}
              {syncStatus.lastSync.recordsCreated.toLocaleString("pt-BR")} novos, {" "}
              {syncStatus.lastSync.recordsUpdated.toLocaleString("pt-BR")} atualizados
              {syncStatus.lastSync.recordsFailed > 0 && (
                <span className="text-red-500">
                  , {syncStatus.lastSync.recordsFailed.toLocaleString("pt-BR")} com erro
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Limite de usuários:</label>
              <input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="Ex: 1000"
                className="w-32 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min="1"
                max="1000000"
              />
              <span className="text-xs text-gray-500">(deixe vazio para todos)</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSync}
                disabled={syncStatus?.isSyncing || syncMutation.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncStatus?.isSyncing || syncMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar agora
                  </>
                )}
              </button>

              <button
                onClick={() => navigate("/settings/external-data/zendesk-users")}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ver usuários
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
