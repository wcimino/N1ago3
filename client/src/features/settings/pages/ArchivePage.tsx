import { useLocation } from "wouter";
import { ArrowLeft, RefreshCw, Play, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { useConfirmation, useDateFormatters } from "../../../shared/hooks";
import { ConfirmModal } from "../../../shared/components";
import { useArchiveData, type ArchiveJob } from "../hooks";
import { ArchiveStatsCards, ActiveJobProgress, ArchiveHistoryTable } from "../components";

export function ArchivePage() {
  const [, navigate] = useLocation();
  const confirmation = useConfirmation();
  const { formatDate: formatDateWithTz, formatDateTime: formatDateTimeWithTz } = useDateFormatters();

  const {
    stats,
    activeJob,
    history,
    loading,
    starting,
    retrying,
    error,
    refresh,
    startArchive,
    retryJob,
    clearError,
  } = useArchiveData();

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateWithTz(dateStr);
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateTimeWithTz(dateStr);
  };

  const handleStart = () => {
    confirmation.confirm({
      title: "Iniciar arquivamento",
      message: "Iniciar o arquivamento? Dados anteriores a ontem serao arquivados em Parquet e removidos do banco.",
      confirmLabel: "Iniciar",
      variant: "warning",
      onConfirm: startArchive,
    });
  };

  const handleRetry = (job: ArchiveJob) => {
    confirmation.confirm({
      title: "Retentar arquivamento",
      message: `Retentar o arquivamento de ${job.tableName} em ${formatDate(job.archiveDate)}?`,
      confirmLabel: "Retentar",
      variant: "warning",
      onConfirm: () => retryJob(job.id),
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        variant={confirmation.variant}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/settings/maintenance")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Arquivamento de Dados</h1>
            <p className="text-gray-600">Arquive dados antigos em Parquet para liberar espaco no banco</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !!activeJob}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Iniciar Arquivamento
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={clearError} className="text-red-600 hover:text-red-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {activeJob && (
        <ActiveJobProgress job={activeJob} formatDate={formatDate} />
      )}

      <ArchiveStatsCards stats={stats} />

      <ArchiveHistoryTable
        history={history}
        loading={loading}
        retrying={retrying}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        onRetry={handleRetry}
      />
    </div>
  );
}
