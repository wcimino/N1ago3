import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Database, Users, RefreshCw, ArrowRight, Clock, CheckCircle, XCircle, Loader2, X, AlertCircle, UserPlus } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";

type SyncType = "full" | "incremental";

interface SyncProgress {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentPage: number;
  estimatedTotal: number;
}

interface SyncStatus {
  isSyncing: boolean;
  currentSyncId: number | null;
  cancelRequested: boolean;
  progress: SyncProgress | null;
  lastSync: {
    id: number;
    status: string;
    syncType: string | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
  } | null;
  totalUsers: number;
  hasCompletedSync: boolean;
}

interface AddNewSyncStatus {
  hasStarted: boolean;
  isComplete: boolean;
  nextCursor: string | null;
  lastSync: {
    id: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsProcessed: number;
    recordsCreated: number;
  } | null;
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
  const [syncType, setSyncType] = useState<SyncType>("full");

  const { data: syncStatus, isLoading, refetch } = useQuery<SyncStatus>({
    queryKey: ["zendesk-users-sync-status"],
    queryFn: () => fetchApi<SyncStatus>("/api/external-data/zendesk-users/sync-status"),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isSyncing ? 2000 : false;
    },
  });

  const { data: addNewStatus, refetch: refetchAddNew } = useQuery<AddNewSyncStatus>({
    queryKey: ["zendesk-users-add-new-status"],
    queryFn: () => fetchApi<AddNewSyncStatus>("/api/external-data/zendesk-users/sync-new-status"),
  });

  const syncNewMutation = useMutation({
    mutationFn: async (params: { maxUsers?: number }) => {
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/sync-new", params.maxUsers ? { maxUsers: params.maxUsers } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-add-new-status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params: { syncType: SyncType; maxUsers?: number }) => {
      const body: { syncType: SyncType; maxUsers?: number } = { syncType: params.syncType };
      if (params.maxUsers) {
        body.maxUsers = params.maxUsers;
      }
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/sync", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/cancel-sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
    },
  });

  const handleSync = () => {
    const limit = maxUsers ? parseInt(maxUsers, 10) : undefined;
    syncMutation.mutate({ syncType, maxUsers: limit });
    setTimeout(() => refetch(), 500);
  };

  const handleSyncNew = () => {
    const limit = maxUsers ? parseInt(maxUsers, 10) : undefined;
    syncNewMutation.mutate({ maxUsers: limit });
    setTimeout(() => {
      refetch();
      refetchAddNew();
    }, 500);
  };

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "cancelled":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
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
      case "cancelled":
        return "Cancelada";
      case "in_progress":
        return "Em andamento";
      default:
        return status;
    }
  };

  const getProgressPercentage = () => {
    if (!syncStatus?.progress) return 0;
    const { processed, estimatedTotal } = syncStatus.progress;
    if (estimatedTotal <= 0) return 0;
    return Math.min(100, Math.round((processed / estimatedTotal) * 100));
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

          {syncStatus?.isSyncing && syncStatus.progress && (
            <div className="bg-white rounded-lg p-4 border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Progresso da sincronização
                </span>
                <span className="text-sm text-gray-500">
                  {syncStatus.progress.processed.toLocaleString("pt-BR")} 
                  {syncStatus.progress.estimatedTotal > 0 && (
                    <> / {syncStatus.progress.estimatedTotal.toLocaleString("pt-BR")}</>
                  )}
                  {" "}usuários
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-orange-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Página {syncStatus.progress.currentPage} | {" "}
                  {syncStatus.progress.created.toLocaleString("pt-BR")} novos, {" "}
                  {syncStatus.progress.updated.toLocaleString("pt-BR")} atualizados
                  {syncStatus.progress.failed > 0 && (
                    <span className="text-red-500">
                      , {syncStatus.progress.failed.toLocaleString("pt-BR")} com erro
                    </span>
                  )}
                </span>
                <span className="font-medium text-orange-600">
                  {getProgressPercentage()}%
                </span>
              </div>
              
              {syncStatus.cancelRequested && (
                <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                  Cancelamento solicitado. Aguardando finalização do batch atual...
                </div>
              )}
            </div>
          )}

          {syncStatus?.lastSync && !syncStatus.isSyncing && (syncStatus.lastSync.status === "completed" || syncStatus.lastSync.status === "cancelled") && (
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
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Tipo de sincronização:</label>
                <select
                  value={syncType}
                  onChange={(e) => setSyncType(e.target.value as SyncType)}
                  disabled={!syncStatus?.hasCompletedSync && syncType === "incremental"}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                >
                  <option value="full">Completa</option>
                  <option value="incremental" disabled={!syncStatus?.hasCompletedSync}>
                    Incremental {!syncStatus?.hasCompletedSync && "(requer sync anterior)"}
                  </option>
                </select>
              </div>

              {syncType === "full" && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Limite:</label>
                  <input
                    type="number"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                    placeholder="Ex: 1000"
                    className="w-28 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min="1"
                    max="1000000"
                  />
                  <span className="text-xs text-gray-500">(vazio = todos)</span>
                </div>
              )}
            </div>

            {syncType === "incremental" && (
              <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                Sincronização incremental busca apenas usuários modificados desde a última sincronização completa.
              </div>
            )}

            {!addNewStatus?.isComplete && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Carregar base completa</span>
                </div>
                <p className="text-xs text-blue-700">
                  {addNewStatus?.hasStarted 
                    ? `Continua de onde parou. Já processados: ${addNewStatus.lastSync?.recordsProcessed.toLocaleString("pt-BR") ?? 0} usuários.`
                    : "Importa todos os usuários do Zendesk. Pode rodar em partes - cada execução continua de onde parou."}
                </p>
                <button
                  onClick={handleSyncNew}
                  disabled={syncStatus?.isSyncing || syncNewMutation.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {syncNewMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {addNewStatus?.hasStarted ? "Continuar importação" : "Adicionar novos usuários"}
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {syncStatus?.isSyncing ? (
                <button
                  onClick={handleCancel}
                  disabled={syncStatus.cancelRequested || cancelMutation.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncStatus.cancelRequested || cancelMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Cancelar sincronização
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4" />
                  {syncType === "incremental" ? "Sincronizar alterações" : "Sincronizar agora"}
                </button>
              )}

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
