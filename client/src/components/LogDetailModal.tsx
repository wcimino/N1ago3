import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { WebhookLogDetail } from "../types";

interface LogDetailModalProps {
  logId: number;
  onClose: () => void;
}

export function LogDetailModal({ logId, onClose }: LogDetailModalProps) {
  const { data: log, isLoading } = useQuery<WebhookLogDetail>({
    queryKey: ["webhook-log", logId],
    queryFn: async () => {
      const res = await fetch(`/api/webhook-logs/${logId}`, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Log #{logId}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : log ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <StatusBadge status={log.processing_status} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP de Origem</label>
                  <p className="mt-1 text-sm">{log.source_ip}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Recebido em</label>
                  <p className="mt-1 text-sm">
                    {format(new Date(log.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Processado em</label>
                  <p className="mt-1 text-sm">
                    {log.processed_at
                      ? format(new Date(log.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                      : "-"}
                  </p>
                </div>
              </div>

              {log.error_message && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Erro</label>
                  <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{log.error_message}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500">Headers</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(log.headers, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Payload</label>
                <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Log não encontrado</p>
          )}
        </div>
      </div>
    </div>
  );
}
