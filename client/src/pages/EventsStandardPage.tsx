import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { EventTypeBadge, AuthorTypeBadge, DataTable, EventDetailModal, type Column } from "../shared/components";
import { useDateFormatters } from "../shared/hooks";
import { fetchApi } from "../lib/queryClient";
import { usePaginatedQuery } from "../shared/hooks";
import type { StandardEvent, StandardEventsStatsResponse } from "../types";

export function EventsStandardPage() {
  const [selectedEvent, setSelectedEvent] = useState<StandardEvent | null>(null);
  const { formatDateTime } = useDateFormatters();

  const {
    data: events,
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
  } = usePaginatedQuery<StandardEvent>({
    queryKey: "standard-events",
    endpoint: "/api/events/events_standard",
    limit: 20,
    dataKey: "events",
  });

  const { data: stats } = useQuery<StandardEventsStatsResponse>({
    queryKey: ["standard-events-stats"],
    queryFn: () => fetchApi<StandardEventsStatsResponse>("/api/events/stats"),
    refetchInterval: 10000,
  });

  const columns: Column<StandardEvent>[] = [
    {
      key: "type",
      header: "Tipo",
      render: (event) => (
        <EventTypeBadge type={event.event_type} subtype={event.event_subtype} displayName={event.display_name} />
      ),
    },
    {
      key: "source",
      header: "Fonte",
      className: "text-sm text-gray-500",
      render: (event) => event.source,
    },
    {
      key: "client",
      header: "Cliente",
      className: "text-sm text-gray-500",
      render: (event) =>
        event.external_user_id ? (
          <span title={event.external_user_id} className="font-mono text-xs">
            {event.external_user_id.slice(0, 12)}...
          </span>
        ) : event.author_type === "customer" && event.author_name ? (
          <span title={event.author_name} className="truncate max-w-[150px] inline-block">
            {event.author_name}
          </span>
        ) : (
          "-"
        ),
    },
    {
      key: "author",
      header: "Autor",
      render: (event) => (
        <div className="flex flex-col gap-1">
          <AuthorTypeBadge type={event.author_type} />
          {event.author_name && <span className="text-xs text-gray-500">{event.author_name}</span>}
        </div>
      ),
    },
    {
      key: "content",
      header: "Conteúdo",
      className: "text-sm text-gray-900 max-w-xs truncate",
      render: (event) => event.content_text || (event.content_payload ? "[payload]" : "-"),
    },
    {
      key: "occurred_at",
      header: "Ocorrido em",
      sortable: true,
      className: "text-sm text-gray-500",
      render: (event) => formatDateTime(event.occurred_at),
    },
    {
      key: "actions",
      header: "Ações",
      hideOnMobile: true,
      render: (event) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEvent(event);
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
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
        <div className="bg-white rounded-lg shadow p-4 sm:min-w-[200px]">
          <p className="text-xs sm:text-sm text-gray-500">Últimas 24h</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {(stats?.total || 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">eventos</p>
        </div>
        {stats?.byType && Object.keys(stats.byType).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 flex-1">
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Por tipo de evento</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="bg-gray-50 rounded px-3 py-1.5 text-sm">
                    <span className="text-gray-700">{type}</span>
                    <span className="ml-2 font-semibold text-gray-900">{count.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={events}
        keyExtractor={(event) => event.id}
        isLoading={isLoading}
        emptyTitle="Nenhum evento registrado ainda."
        emptyDescription="Os eventos serão criados quando mensagens chegarem via webhook."
        onRowClick={(event) => setSelectedEvent(event)}
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
          itemLabel: "eventos",
        }}
      />

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
