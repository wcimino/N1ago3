import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { useConfirmation } from "../../../shared/hooks";
import { ConfirmModal } from "../../../shared/components";
import { RefreshCw, Trash2, Database, Clock, Activity, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QueryStat {
  id: number;
  queryHash: string;
  queryNormalized: string;
  callCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  lastCalledAt: string;
}

interface QueryLog {
  id: number;
  queryHash: string;
  queryNormalized: string;
  durationMs: number;
  rowsAffected: number | null;
  source: string | null;
  createdAt: string;
}

interface Summary {
  totalQueries: number;
  uniqueQueries: number;
  avgDurationMs: string;
  maxDurationMs: number;
  slowQueriesCount: number;
  slowQueryThresholdMs: number;
}

interface Config {
  enabled: boolean;
  logToConsole: boolean;
  slowQueryThresholdMs: number;
  pendingLogsCount: number;
}

type OrderBy = "callCount" | "avgDuration" | "totalDuration" | "maxDuration";
type Period = "1h" | "24h";

export function QueryMonitoringTab() {
  const queryClient = useQueryClient();
  const confirmation = useConfirmation();
  const [orderBy, setOrderBy] = useState<OrderBy>("callCount");
  const [period, setPeriod] = useState<Period>("24h");
  const [showSlowQueries, setShowSlowQueries] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["query-monitoring-summary", period],
    queryFn: () => fetchApi<Summary>(`/api/monitoring/queries/summary?period=${period}`),
    refetchInterval: 10000,
  });

  const { data: config } = useQuery<Config>({
    queryKey: ["query-monitoring-config"],
    queryFn: () => fetchApi<Config>("/api/monitoring/queries/config"),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: QueryStat[] }>({
    queryKey: ["query-monitoring-stats", orderBy, period],
    queryFn: () => fetchApi<{ stats: QueryStat[] }>(`/api/monitoring/queries/stats?orderBy=${orderBy}&limit=30&period=${period}`),
    refetchInterval: 15000,
  });

  const { data: slowQueriesData, isLoading: slowLoading } = useQuery<{ queries: QueryLog[] }>({
    queryKey: ["query-monitoring-slow", period],
    queryFn: () => fetchApi<{ queries: QueryLog[] }>(`/api/monitoring/queries/slow-queries?threshold=100&limit=30&period=${period}`),
    enabled: showSlowQueries,
    refetchInterval: 15000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monitoring/queries/clear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-stats"] });
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-summary"] });
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-slow"] });
    },
  });

  const flushMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/monitoring/queries/flush"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-stats"] });
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-summary"] });
    },
  });

  const toggleConfigMutation = useMutation({
    mutationFn: (updates: Partial<Config>) => apiRequest("POST", "/api/monitoring/queries/config", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["query-monitoring-config"] });
    },
  });

  const stats = statsData?.stats || [];
  const slowQueries = slowQueriesData?.queries || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Monitoramento de Queries</h2>
          <p className="text-sm text-gray-500">
            Acompanhe as queries SQL mais executadas e identifique gargalos de performance
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 text-sm border rounded-lg bg-white"
          >
            <option value="1h">Ultima hora</option>
            <option value="24h">Ultimas 24h</option>
          </select>
          <button
            onClick={() => flushMutation.mutate()}
            disabled={flushMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${flushMutation.isPending ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={() => {
              confirmation.confirm({
                title: "Limpar estatísticas",
                message: "Limpar todas as estatísticas de queries?",
                confirmLabel: "Limpar",
                variant: "danger",
                onConfirm: () => clearMutation.mutate(),
              });
            }}
            disabled={clearMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Limpar
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Database className="w-4 h-4" />
              <span className="text-sm font-medium">Total Queries</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{summary.totalQueries.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Queries Unicas</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{summary.uniqueQueries}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Duracao Media</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{summary.avgDurationMs}ms</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Duracao Maxima</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">{summary.maxDurationMs}ms</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Queries Lentas</span>
            </div>
            <p className="text-2xl font-bold text-red-900">{summary.slowQueriesCount}</p>
            <p className="text-xs text-red-500">{">"}={summary.slowQueryThresholdMs}ms</p>
          </div>
        </div>
      )}

      {config && (
        <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => toggleConfigMutation.mutate({ enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Logging ativo</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.logToConsole}
                onChange={(e) => toggleConfigMutation.mutate({ logToConsole: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Log no console</span>
            </label>
          </div>
          <span className="text-sm text-gray-500">
            {config.pendingLogsCount} logs pendentes
          </span>
        </div>
      )}

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setShowSlowQueries(false)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            !showSlowQueries
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Estatisticas por Query
        </button>
        <button
          onClick={() => setShowSlowQueries(true)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            showSlowQueries
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Queries Lentas Recentes
        </button>
      </div>

      {!showSlowQueries && (
        <>
          <div className="flex gap-2">
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as OrderBy)}
              className="px-3 py-2 text-sm border rounded-lg"
            >
              <option value="callCount">Mais executadas</option>
              <option value="avgDuration">Maior duracao media</option>
              <option value="totalDuration">Maior tempo total</option>
              <option value="maxDuration">Maior pico</option>
            </select>
          </div>

          {statsLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : stats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma query registrada ainda. As estatisticas aparecerao conforme o sistema for usado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Chamadas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Media</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ultima</th>
                  </tr>
                  <tr className="bg-blue-50 border-b-2 border-blue-200">
                    <td className="px-4 py-2 text-xs font-semibold text-blue-800">
                      TOTAIS ({stats.length} queries listadas)
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-blue-900">
                      {stats.reduce((sum, s) => sum + s.callCount, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-blue-800">
                      {stats.length > 0 ? (stats.reduce((sum, s) => sum + s.avgDurationMs, 0) / stats.length).toFixed(1) : 0}ms
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-blue-800">
                      {Math.max(...stats.map(s => s.maxDurationMs), 0)}ms
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-blue-900">
                      {(stats.reduce((sum, s) => sum + s.totalDurationMs, 0) / 1000).toFixed(1)}s
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-blue-600">-</td>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.map((stat) => (
                    <tr key={stat.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-700 font-mono block max-w-lg truncate" title={stat.queryNormalized}>
                          {stat.queryNormalized}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {stat.callCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {stat.avgDurationMs.toFixed(1)}ms
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <span className={stat.maxDurationMs > 100 ? "text-red-600 font-medium" : "text-gray-700"}>
                          {stat.maxDurationMs}ms
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {(stat.totalDurationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {formatDistanceToNow(new Date(stat.lastCalledAt), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showSlowQueries && (
        <>
          {slowLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : slowQueries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma query lenta registrada (threshold: 100ms)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duracao</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Linhas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quando</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {slowQueries.map((query) => (
                    <tr key={query.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-700 font-mono block max-w-lg truncate" title={query.queryNormalized}>
                          {query.queryNormalized}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${query.durationMs > 500 ? "text-red-600" : "text-orange-600"}`}>
                          {query.durationMs}ms
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {query.rowsAffected ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        variant={confirmation.variant}
      />
    </div>
  );
}
