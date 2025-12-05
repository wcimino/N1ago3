import { EventTypeBadge, AuthorTypeBadge } from "./index";
import { formatDateTime } from "../lib/dateUtils";
import type { StandardEvent } from "../types";

interface EventDetailModalProps {
  event: StandardEvent;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Evento #{event.id}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            &times;
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo</label>
                <div className="mt-1">
                  <EventTypeBadge
                    type={event.event_type}
                    subtype={event.event_subtype}
                    displayName={event.display_name}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Fonte</label>
                <p className="mt-1 text-sm">{event.source}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Autor</label>
                <div className="mt-1">
                  <AuthorTypeBadge type={event.author_type} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Canal</label>
                <p className="mt-1 text-sm">{event.channel_type || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Ocorrido em</label>
                <p className="mt-1 text-sm">{formatDateTime(event.occurred_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Recebido em</label>
                <p className="mt-1 text-sm">{formatDateTime(event.received_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">ID Conversa (externo)</label>
                <p className="mt-1 text-sm font-mono text-xs">{event.external_conversation_id || "-"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ID Usuário (externo)</label>
                <p className="mt-1 text-sm font-mono text-xs">{event.external_user_id || "-"}</p>
              </div>
            </div>

            {event.content_text && (
              <div>
                <label className="text-sm font-medium text-gray-500">Conteúdo</label>
                <p className="mt-1 text-sm bg-gray-50 p-3 rounded">{event.content_text}</p>
              </div>
            )}

            {event.content_payload && (
              <div>
                <label className="text-sm font-medium text-gray-500">Payload do Conteúdo</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(event.content_payload, null, 2)}
                </pre>
              </div>
            )}

            {event.metadata && (
              <div>
                <label className="text-sm font-medium text-gray-500">Metadata</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
