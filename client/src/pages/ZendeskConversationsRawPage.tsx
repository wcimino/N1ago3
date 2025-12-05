import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Eye, ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";
import { StatusBadge, LogDetailModal } from "../components";
import type { WebhookLogsResponse } from "../types";

export function ZendeskConversationsRawPage() {
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
    navigate("/events/zendesk_conversations_raw");
    setPage(0);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Zendesk Conversations Raw</h2>
            <p className="text-sm text-gray-500 mt-1">Webhooks brutos recebidos do Zendesk (legado)</p>
          </div>
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
