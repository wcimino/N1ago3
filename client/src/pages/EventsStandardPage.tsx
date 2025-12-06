import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { EventTypeBadge, AuthorTypeBadge, DataTable, EventDetailModal, type Column } from "../components";
import { formatDateTime } from "../lib/dateUtils";
import { usePaginatedQuery } from "../hooks/usePaginatedQuery";
import type { StandardEvent, StandardEventsStatsResponse } from "../types";

export function EventsStandardPage() {
  const [selectedEvent, setSelectedEvent] = useState<StandardEvent | null>(null);

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
    queryFn: async () => {
      const res = await fetch("/api/events/stats", { credentials: "include" });
      return res.json();
    },
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
      <div className="mb-4 sm:mb-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total de Eventos</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
        </div>
        {stats?.byType &&
          Object.entries(stats.byType)
            .slice(0, 3)
            .map(([type, count]) => (
              <div key={type} className="bg-white rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 truncate">{type}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Eventos Padronizados</h2>
          <p className="text-sm text-gray-500 mt-1">Eventos normalizados de todas as fontes</p>
        </div>

        <DataTable
          columns={columns}
          data={events}
          keyExtractor={(event) => event.id}
          isLoading={isLoading}
          emptyTitle="Nenhum evento padronizado ainda."
          emptyDescription="Eventos aparecem aqui depois de processados pelo adaptador."
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
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
