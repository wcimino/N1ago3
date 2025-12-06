import { Modal, ModalField, ModalGrid, ModalCodeBlock } from "./ui/Modal";
import { EventTypeBadge, AuthorTypeBadge } from "./index";
import { useDateFormatters } from "../hooks/useDateFormatters";
import type { StandardEvent } from "../types";

interface EventDetailModalProps {
  event: StandardEvent;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { formatDateTime } = useDateFormatters();

  return (
    <Modal title={`Evento #${event.id}`} onClose={onClose}>
      <div className="space-y-4">
        <ModalGrid cols={4}>
          <ModalField label="Tipo">
            <EventTypeBadge
              type={event.event_type}
              subtype={event.event_subtype}
              displayName={event.display_name}
            />
          </ModalField>
          <ModalField label="Fonte">
            <p className="text-sm">{event.source}</p>
          </ModalField>
          <ModalField label="Autor">
            <AuthorTypeBadge type={event.author_type} />
          </ModalField>
          <ModalField label="Canal">
            <p className="text-sm">{event.channel_type || "-"}</p>
          </ModalField>
        </ModalGrid>

        <ModalGrid>
          <ModalField label="Ocorrido em">
            <p className="text-sm">{formatDateTime(event.occurred_at)}</p>
          </ModalField>
          <ModalField label="Recebido em">
            <p className="text-sm">{formatDateTime(event.received_at)}</p>
          </ModalField>
        </ModalGrid>

        <ModalGrid>
          <ModalField label="ID Conversa (externo)">
            <p className="text-sm font-mono text-xs">{event.external_conversation_id || "-"}</p>
          </ModalField>
          <ModalField label="ID Usuário (externo)">
            <p className="text-sm font-mono text-xs">{event.external_user_id || "-"}</p>
          </ModalField>
        </ModalGrid>

        {event.content_text && (
          <div>
            <label className="text-sm font-medium text-gray-500">Conteúdo</label>
            <p className="mt-1 text-sm bg-gray-50 p-3 rounded">{event.content_text}</p>
          </div>
        )}

        {event.content_payload && (
          <ModalCodeBlock label="Payload do Conteúdo" data={event.content_payload} />
        )}

        {event.metadata && (
          <ModalCodeBlock label="Metadata" data={event.metadata} />
        )}
      </div>
    </Modal>
  );
}
