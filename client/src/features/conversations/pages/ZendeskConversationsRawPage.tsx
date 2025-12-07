import { useState } from "react";
import { useLocation } from "wouter";
import { Eye } from "lucide-react";
import { StatusBadge, LogDetailModal, DataTable, type Column } from "../components";
import { useDateFormatters } from "../../../shared/hooks/useDateFormatters";
import { usePaginatedQuery } from "../../../shared/hooks/usePaginatedQuery";
import type { WebhookLog } from "../types";

export function ZendeskConversationsRawPage() {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { formatDateTime } = useDateFormatters();

  const urlParams = new URLSearchParams(window.location.search);
  const userFilter = urlParams.get("user");

  const endpoint = userFilter ? `/api/webhook-logs?user=${encodeURIComponent(userFilter)}` : "/api/webhook-logs";

  const {
    data: logs,
    total,
    page,
    totalPages,
    isLoading,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  } = usePaginatedQuery<WebhookLog>({
    queryKey: `webhook-logs-${userFilter || "all"}`,
    endpoint,
    limit: 20,
    dataKey: "logs",
  });

  const clearFilter = () => {
    navigate("/events/zendesk_conversations_raw");
  };

  const columns: Column<WebhookLog>[] = [
    {
      key: "id",
      header: "ID",
      className: "text-sm font-medium text-gray-900",
      render: (log) => `#${log.id}`,
    },
    {
      key: "received_at",
      header: "Recebido",
      sortable: true,
      className: "text-sm text-gray-500",
      render: (log) => formatDateTime(log.received_at),
    },
    {
      key: "source_ip",
      header: "IP",
      className: "text-sm text-gray-500",
      render: (log) => log.source_ip,
    },
    {
      key: "processing_status",
      header: "Status",
      render: (log) => <StatusBadge status={log.processing_status} />,
    },
    {
      key: "error_message",
      header: "Erro",
      className: "text-sm text-red-500 max-w-xs truncate",
      render: (log) => log.error_message || "-",
    },
    {
      key: "actions",
      header: "Ações",
      hideOnMobile: true,
      render: (log) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLogId(log.id);
          }}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
        >
          <Eye className="w-4 h-4" />
          Ver
        </button>
      ),
    },
  ];

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

        <DataTable
          columns={columns}
          data={logs}
          keyExtractor={(log) => log.id}
          isLoading={isLoading}
          emptyTitle="Nenhum evento recebido ainda."
          emptyDescription="Configure o webhook no Zendesk para começar a receber eventos."
          onRowClick={(log) => setSelectedLogId(log.id)}
          pagination={{
            page,
            totalPages,
            showingFrom,
            showingTo,
            total,
            onPreviousPage: previousPage,
            onNextPage: nextPage,
            hasPreviousPage,
            hasNextPage,
            itemLabel: "logs",
          }}
        />
      </div>

      {selectedLogId !== null && (
        <LogDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
      )}
    </>
  );
}
