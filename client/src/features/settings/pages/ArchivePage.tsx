import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Archive, Database, RefreshCw, Play, CheckCircle, XCircle, Clock, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import { apiRequest, fetchApi } from "../../../lib/queryClient";
import { formatNumber } from "../../../lib/formatters";
import { useConfirmation, useDateFormatters } from "../../../shared/hooks";
import { ConfirmModal } from "../../../shared/components";

interface ArchiveStats {
  pendingRecords: number;
  pendingDays: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalArchivedRecords: number;
}

interface ArchiveProgress {
  phase: string;
  currentTable?: string;
  currentDate?: string;
  recordsProcessed: number;
}

interface ActiveJob {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  progress: ArchiveProgress | null;
  errorMessage: string | null;
  recordsArchived: number;
  recordsDeleted: number;
}

interface ArchiveJob {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  recordsArchived: number;
  recordsDeleted: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function ArchivePage() {
  const [, navigate] = useLocation();
  const confirmation = useConfirmation();
  const { formatDate: formatDateWithTz, formatDateTime: formatDateTimeWithTz } = useDateFormatters();

  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [history, setHistory] = useState<ArchiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateWithTz(dateStr);
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateTimeWithTz(dateStr);
  };

  const fetchStats = async () => {
    try {
      const data = await fetchApi<ArchiveStats>("/api/maintenance/archive/stats");
      setStats(data);
    } catch (err: any) {
      console.error("Erro ao buscar estatisticas:", err);
    }
  };

  const fetchProgress = async () => {
    try {
      const data = await fetchApi<{ isRunning: boolean; job: ActiveJob | null }>("/api/maintenance/archive/progress");
      setActiveJob(data.job);
      return data.isRunning;
    } catch (err: any) {
      console.error("Erro ao buscar progresso:", err);
      return false;
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await fetchApi<ArchiveJob[]>("/api/maintenance/archive/history?limit=20");
      setHistory(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar historico:", err);
      setHistory([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.allSettled([fetchStats(), fetchProgress(), fetchHistory()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeJob && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const stillRunning = await fetchProgress();
        if (!stillRunning) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          await Promise.allSettled([fetchStats(), fetchHistory()]);
        }
      }, 2000);
    } else if (!activeJob && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [activeJob]);

  const startArchive = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/maintenance/archive/start");
      const data = await response.json();
      if (response.ok) {
        await fetchProgress();
      } else {
        setError(data.error || "Erro ao iniciar arquivamento");
      }
    } catch (err: any) {
      console.error("Erro ao iniciar arquivamento:", err);
      setError(err.message || "Erro ao iniciar arquivamento");
    }
    setStarting(false);
  };

  const retryJob = async (jobId: number) => {
    setRetrying(jobId);
    setError(null);
    try {
      const response = await apiRequest("POST", `/api/maintenance/archive/retry/${jobId}`);
      const data = await response.json();
      if (response.ok) {
        await Promise.allSettled([fetchProgress(), fetchHistory()]);
      } else {
        setError(data.error || "Erro ao retentar job");
      }
    } catch (err: any) {
      console.error("Erro ao retentar job:", err);
      setError(err.message || "Erro ao retentar job");
    }
    setRetrying(null);
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

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.allSettled([fetchStats(), fetchProgress(), fetchHistory()]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
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
            onClick={handleRefresh}
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
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {activeJob && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <h2 className="text-lg font-semibold text-blue-900">Arquivamento em Execucao</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-blue-600">Tabela</p>
              <p className="font-medium">{activeJob.tableName}</p>
            </div>
            <div>
              <p className="text-blue-600">Data</p>
              <p className="font-medium">{formatDate(activeJob.archiveDate)}</p>
            </div>
            <div>
              <p className="text-blue-600">Fase</p>
              <p className="font-medium capitalize">{activeJob.progress?.phase || "Iniciando..."}</p>
            </div>
            <div>
              <p className="text-blue-600">Processados</p>
              <p className="font-medium">{formatNumber(activeJob.progress?.recordsProcessed || 0)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.pendingRecords) : "-"}</p>
              <p className="text-xs text-gray-500">{stats?.pendingDays || 0} dias</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Concluidos</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.completedJobs) : "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats?.failedJobs ? "bg-red-100" : "bg-gray-100"}`}>
              <XCircle className={`w-5 h-5 ${stats?.failedJobs ? "text-red-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Falharam</p>
              <p className={`text-xl font-bold ${stats?.failedJobs ? "text-red-600" : ""}`}>
                {stats ? formatNumber(stats.failedJobs) : "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Archive className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Arquivado</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.totalArchivedRecords) : "-"}</p>
            </div>
          </div>
        </div>
      </div>

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
                        onClick={() => handleRetry(job)}
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
    </div>
  );
}
