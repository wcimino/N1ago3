import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Eye, ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";
import { EventTypeBadge, AuthorTypeBadge } from "../components";
import type { StandardEvent, StandardEventsResponse, StandardEventsStatsResponse } from "../types";

export function EventsStandardPage() {
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<StandardEvent | null>(null);
  const limit = 20;

  const { data: eventsData, isLoading } = useQuery<StandardEventsResponse>({
    queryKey: ["standard-events", page],
    queryFn: async () => {
      const res = await fetch(`/api/events/events_standard?limit=${limit}&offset=${page * limit}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<StandardEventsStatsResponse>({
    queryKey: ["standard-events-stats"],
    queryFn: async () => {
      const res = await fetch("/api/events/stats", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const totalPages = eventsData ? Math.ceil(eventsData.total / limit) : 0;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total de Eventos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
        </div>
        {stats?.byType && Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
          <div key={type} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">{type}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Eventos Padronizados</h2>
          <p className="text-sm text-gray-500 mt-1">Eventos normalizados de todas as fontes</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !eventsData?.events || eventsData.events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhum evento padronizado ainda.</p>
            <p className="text-sm mt-1">Eventos aparecem aqui depois de processados pelo adaptador.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conteúdo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <span className="inline-flex items-center gap-1">
                        Ocorrido em
                        <ArrowDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {eventsData.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <EventTypeBadge type={event.event_type} subtype={event.event_subtype} displayName={event.display_name} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{event.source}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {event.external_user_id ? (
                          <span title={event.external_user_id} className="font-mono text-xs">
                            {event.external_user_id.slice(0, 12)}...
                          </span>
                        ) : event.author_type === "customer" && event.author_name ? (
                          <span title={event.author_name} className="truncate max-w-[150px] inline-block">
                            {event.author_name}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <AuthorTypeBadge type={event.author_type} />
                          {event.author_name && (
                            <span className="text-xs text-gray-500">{event.author_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                        {event.content_text || (event.content_payload ? "[payload]" : "-")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(new Date(event.occurred_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEvent(event)}
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
                Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, eventsData?.total || 0)} de{" "}
                {eventsData?.total || 0}
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

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Evento #{selectedEvent.id}</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                &times;
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tipo</label>
                    <div className="mt-1">
                      <EventTypeBadge type={selectedEvent.event_type} subtype={selectedEvent.event_subtype} displayName={selectedEvent.display_name} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Fonte</label>
                    <p className="mt-1 text-sm">{selectedEvent.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Autor</label>
                    <div className="mt-1">
                      <AuthorTypeBadge type={selectedEvent.author_type} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Canal</label>
                    <p className="mt-1 text-sm">{selectedEvent.channel_type || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ocorrido em</label>
                    <p className="mt-1 text-sm">
                      {format(new Date(selectedEvent.occurred_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Recebido em</label>
                    <p className="mt-1 text-sm">
                      {format(new Date(selectedEvent.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Conversa (externo)</label>
                    <p className="mt-1 text-sm font-mono text-xs">{selectedEvent.external_conversation_id || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Usuário (externo)</label>
                    <p className="mt-1 text-sm font-mono text-xs">{selectedEvent.external_user_id || "-"}</p>
                  </div>
                </div>

                {selectedEvent.content_text && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Conteúdo</label>
                    <p className="mt-1 text-sm bg-gray-50 p-3 rounded">{selectedEvent.content_text}</p>
                  </div>
                )}

                {selectedEvent.content_payload && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payload do Conteúdo</label>
                    <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                      {JSON.stringify(selectedEvent.content_payload, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.metadata && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Metadata</label>
                    <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
