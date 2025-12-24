import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Archive, Database, RefreshCw, Play, CheckCircle, XCircle, Clock, FileArchive, AlertTriangle, Wrench } from "lucide-react";
import { apiRequest, fetchApi } from "../../../lib/queryClient";
import { formatNumber } from "../../../lib/formatters";
import { useConfirmation, useDateFormatters } from "../../../shared/hooks";
import { ConfirmModal } from "../../../shared/components";

interface TableStats {
  pendingRecords: number;
  pendingDays: number;
  oldestDate: string | null;
}

interface ArchiveStats {
  zendeskWebhook: TableStats;
  openaiLogs: TableStats;
  responsesSuggested: TableStats;
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
  inconsistentJobs: number;
}

interface ArchiveProgress {
  tableName: string;
  status: string;
  currentDate: string | null;
  currentHour: number | null;
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
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArchivePage() {
  const [, navigate] = useLocation();
  const confirmation = useConfirmation();
  const { formatDate: formatDateWithTz, formatDateTime: formatDateTimeWithTz } = useDateFormatters();

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateWithTz(dateStr);
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return formatDateTimeWithTz(dateStr);
  };
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [progress, setProgress] = useState<{ isRunning: boolean; progress: ArchiveProgress | null }>({ isRunning: false, progress: null });
  const [history, setHistory] = useState<ArchiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [inconsistentJobs, setInconsistentJobs] = useState<ArchiveJob[]>([]);
  const [showInconsistent, setShowInconsistent] = useState(false);
  const [fixingJob, setFixingJob] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    try {
      const data = await fetchApi<ArchiveStats>("/api/maintenance/archive/stats");
      setStats(data);
    } catch (error) {
      console.error("Erro ao buscar estatisticas:", error);
    }
  };

  const fetchProgress = async () => {
    try {
      const data = await fetchApi<{ isRunning: boolean; progress: ArchiveProgress | null }>("/api/maintenance/archive/progress");
      setProgress(data);
      return data.isRunning;
    } catch (error) {
      console.error("Erro ao buscar progresso:", error);
      return false;
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await fetchApi<ArchiveJob[]>("/api/maintenance/archive/history?limit=20");
      setHistory(data);
    } catch (error) {
      console.error("Erro ao buscar historico:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchProgress(), fetchHistory()]);
      setLoading(false);
    };
    loadData();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (progress.isRunning && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const stillRunning = await fetchProgress();
        if (!stillRunning) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          await Promise.all([fetchStats(), fetchHistory()]);
        }
      }, 2000);
    } else if (!progress.isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [progress.isRunning]);

  const startArchive = async () => {
    setStarting(true);
    try {
      await apiRequest("POST", "/api/maintenance/archive/start");
      await fetchProgress();
    } catch (error) {
      console.error("Erro ao iniciar arquivamento:", error);
    }
    setStarting(false);
  };

  const handleStart = () => {
    confirmation.confirm({
      title: "Iniciar arquivamento",
      message: "Iniciar o arquivamento? Dados anteriores a ontem serão arquivados em Parquet e removidos do banco.",
      confirmLabel: "Iniciar",
      variant: "warning",
      onConfirm: startArchive,
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchProgress(), fetchHistory()]);
    setLoading(false);
  };

  const fetchInconsistentJobs = async () => {
    try {
      setError(null);
      const data = await fetchApi<{ jobs: ArchiveJob[]; count: number }>("/api/maintenance/archive/inconsistent");
      setInconsistentJobs(data.jobs ?? []);
      setShowInconsistent(true);
    } catch (err: any) {
      console.error("Erro ao buscar jobs inconsistentes:", err);
      setError(err.message || "Erro ao buscar jobs inconsistentes");
    }
  };

  const fixInconsistentJob = async (job: ArchiveJob) => {
    setFixingJob(job.id);
    try {
      setError(null);
      const dateStr = job.archiveDate?.split("T")[0] ?? "";
      await apiRequest("POST", `/api/maintenance/archive/force?table=${job.tableName}&date=${dateStr}`);
      await fetchStats();
      setInconsistentJobs(prev => prev.filter(j => j.id !== job.id));
    } catch (err: any) {
      console.error("Erro ao corrigir job:", err);
      setError(err.message || "Erro ao corrigir job");
    }
    setFixingJob(null);
  };

  const handleFixJob = (job: ArchiveJob) => {
    const dateStr = job.archiveDate.split("T")[0];
    confirmation.confirm({
      title: "Corrigir job inconsistente",
      message: `Forcar re-arquivamento de ${job.tableName} em ${dateStr}? Isso vai deletar os registros que foram arquivados mas nao removidos do banco.`,
      confirmLabel: "Corrigir",
      variant: "warning",
      onConfirm: () => fixInconsistentJob(job),
    });
  };

  const totalPending = (stats?.zendeskWebhook.pendingRecords || 0) + 
    (stats?.openaiLogs.pendingRecords || 0) + 
    (stats?.responsesSuggested.pendingRecords || 0);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">Zendesk Webhooks</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.zendeskWebhook.pendingRecords) : "-"}</p>
              <p className="text-xs text-gray-500">{stats?.zendeskWebhook.pendingDays || 0} dias</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">OpenAI Logs</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.openaiLogs.pendingRecords) : "-"}</p>
              <p className="text-xs text-gray-500">{stats?.openaiLogs.pendingDays || 0} dias</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">Respostas Sugeridas</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.responsesSuggested.pendingRecords) : "-"}</p>
              <p className="text-xs text-gray-500">{stats?.responsesSuggested.pendingDays || 0} dias</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">Jobs Completados</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.completedJobs) : "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <FileArchive className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">Total Arquivado</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.totalArchivedRecords) : "-"}</p>
            </div>
          </div>
        </div>

        <div 
          className={`bg-white rounded-lg border p-4 ${stats?.inconsistentJobs && stats.inconsistentJobs > 0 ? 'border-red-300 bg-red-50 cursor-pointer hover:bg-red-100' : ''}`}
          onClick={() => stats?.inconsistentJobs && stats.inconsistentJobs > 0 && fetchInconsistentJobs()}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stats?.inconsistentJobs && stats.inconsistentJobs > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <XCircle className={`w-5 h-5 ${stats?.inconsistentJobs && stats.inconsistentJobs > 0 ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600 truncate">Jobs Inconsistentes</p>
              <p className={`text-xl font-bold ${stats?.inconsistentJobs && stats.inconsistentJobs > 0 ? 'text-red-600' : ''}`}>
                {stats ? formatNumber(stats.inconsistentJobs) : "-"}
              </p>
              {stats?.inconsistentJobs && stats.inconsistentJobs > 0 && (
                <p className="text-xs text-red-500">Clique para corrigir</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showInconsistent && inconsistentJobs.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-800">Jobs Inconsistentes</h2>
            </div>
            <button
              onClick={() => setShowInconsistent(false)}
              className="text-red-600 hover:text-red-800"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-red-700 mb-4">
            Estes jobs foram arquivados mas os registros nao foram deletados do banco. Clique em "Corrigir" para deletar os registros.
          </p>
          <div className="space-y-2">
            {inconsistentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono text-sm">{job.tableName}</p>
                    <p className="text-xs text-gray-500">{formatDate(job.archiveDate)}</p>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="text-green-600">{formatNumber(job.recordsArchived)} arquivados</span>
                    <span className="mx-2">|</span>
                    <span className="text-red-600">{formatNumber(job.recordsDeleted)} deletados</span>
                  </div>
                </div>
                <button
                  onClick={() => handleFixJob(job)}
                  disabled={fixingJob === job.id || progress.isRunning}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  {fixingJob === job.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4" />
                  )}
                  {fixingJob === job.id ? "Corrigindo..." : "Corrigir"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Acoes</h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleStart}
            disabled={starting || progress.isRunning || totalPending === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {progress.isRunning ? "Em execucao..." : starting ? "Iniciando..." : "Iniciar Arquivamento"}
          </button>
        </div>

        {progress.isRunning && progress.progress && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-800">Arquivando...</span>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Tabela: <span className="font-mono">{progress.progress.tableName}</span></p>
              <p>Data: {progress.progress.currentDate} {progress.progress.currentHour !== null && <span className="text-blue-600">- Hora {String(progress.progress.currentHour).padStart(2, '0')}:00</span>}</p>
              <div className="flex items-center gap-2">
                <span>Progresso do dia:</span>
                <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden max-w-[200px]">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress.progress.currentHour !== null ? ((progress.progress.currentHour + 1) / 24) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs">{progress.progress.currentHour !== null ? progress.progress.currentHour + 1 : 0}/24h</span>
              </div>
              <p>Registros lidos: {formatNumber(progress.progress.recordsArchived)}</p>
              <p>Registros deletados: {formatNumber(progress.progress.recordsDeleted)}</p>
            </div>
          </div>
        )}

        {totalPending === 0 && !progress.isRunning && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">Nenhum dado pendente para arquivamento.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Historico de Arquivamento</h2>
          <p className="text-sm text-gray-600">Ultimos jobs de arquivamento executados</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum arquivamento realizado ainda</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tabela</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Registros</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tamanho</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concluido</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-xs">{job.tableName}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(job.archiveDate)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "completed" ? "bg-green-100 text-green-700" :
                        job.status === "failed" ? "bg-red-100 text-red-700" :
                        job.status === "running" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {job.status === "completed" && <CheckCircle className="w-3 h-3" />}
                        {job.status === "failed" && <XCircle className="w-3 h-3" />}
                        {job.status === "running" && <Clock className="w-3 h-3" />}
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{formatNumber(job.recordsArchived)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatBytes(job.fileSize)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(job.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  );
}
