import { CheckCircle, XCircle, Clock, Loader2, RotateCcw } from "lucide-react";
import { formatNumber } from "../../../../lib/formatters";
import type { ArchiveJob } from "../../hooks/useArchiveData";

interface ArchiveHistoryTableProps {
  history: ArchiveJob[];
  loading: boolean;
  retrying: number | null;
  formatDate: (dateStr: string | null) => string;
  formatDateTime: (dateStr: string | null) => string;
  onRetry: (job: ArchiveJob) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Concluido</span>;
    case "running":
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Em execucao</span>;
    case "failed":
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> Falhou</span>;
    case "invalidated":
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Invalidado</span>;
    default:
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>;
  }
}

export function ArchiveHistoryTable({
  history,
  loading,
  retrying,
  formatDate,
  formatDateTime,
  onRetry,
}: ArchiveHistoryTableProps) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Historico de Jobs</h2>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Carregando...
        </div>
      ) : history.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Nenhum job de arquivamento encontrado
        </div>
      ) : (
        <div className="divide-y">
          {history.map((job) => (
            <div key={job.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusBadge(job.status)}
                  <div>
                    <p className="font-medium">{job.tableName}</p>
                    <p className="text-sm text-gray-500">{formatDate(job.archiveDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-gray-600">
                      {formatNumber(job.recordsArchived)} arquivados / {formatNumber(job.recordsDeleted)} deletados
                    </p>
                    <p className="text-xs text-gray-400">{formatDateTime(job.createdAt)}</p>
                  </div>
                  {job.status === "failed" && (
                    <button
                      onClick={() => onRetry(job)}
                      disabled={retrying === job.id}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                      title="Retentar"
                    >
                      {retrying === job.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              {job.errorMessage && (
                <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                  {job.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
