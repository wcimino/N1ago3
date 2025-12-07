import { useQuery } from "@tanstack/react-query";
import { Modal, ModalField, ModalGrid, ModalCodeBlock, LoadingState } from "../ui";
import { StatusBadge } from "../badges";
import { useDateFormatters } from "../../hooks";
import { fetchApi } from "../../../lib/queryClient";
import type { WebhookLogDetail } from "../../../types";

interface LogDetailModalProps {
  logId: number;
  onClose: () => void;
}

export function LogDetailModal({ logId, onClose }: LogDetailModalProps) {
  const { formatDateTime } = useDateFormatters();
  
  const { data: log, isLoading } = useQuery<WebhookLogDetail>({
    queryKey: ["webhook-log", logId],
    queryFn: () => fetchApi<WebhookLogDetail>(`/api/webhook-logs/${logId}`),
  });

  const loadingContent = <LoadingState />;

  return (
    <Modal
      title={`Log #${logId}`}
      onClose={onClose}
      isLoading={isLoading}
      loadingContent={loadingContent}
    >
      {log ? (
        <div className="space-y-4">
          <ModalGrid>
            <ModalField label="Status">
              <StatusBadge status={log.processing_status} />
            </ModalField>
            <ModalField label="IP de Origem">
              <p className="text-sm">{log.source_ip}</p>
            </ModalField>
            <ModalField label="Recebido em">
              <p className="text-sm">{formatDateTime(log.received_at)}</p>
            </ModalField>
            <ModalField label="Processado em">
              <p className="text-sm">{log.processed_at ? formatDateTime(log.processed_at) : "-"}</p>
            </ModalField>
          </ModalGrid>

          {log.error_message && (
            <div>
              <label className="text-sm font-medium text-gray-500">Erro</label>
              <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{log.error_message}</p>
            </div>
          )}

          <ModalCodeBlock label="Headers" data={log.headers} />
          <ModalCodeBlock label="Payload" data={log.payload} maxHeight="max-h-60" />
        </div>
      ) : (
        <p className="text-gray-500">Log não encontrado</p>
      )}
    </Modal>
  );
}
