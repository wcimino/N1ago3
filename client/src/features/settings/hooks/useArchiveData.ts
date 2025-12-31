import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, fetchApi } from "../../../lib/queryClient";

export interface ArchiveStats {
  pendingRecords: number;
  pendingDays: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalArchivedRecords: number;
}

export interface ArchiveProgress {
  phase: string;
  currentTable?: string;
  currentDate?: string;
  recordsProcessed: number;
}

export interface ActiveJob {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  progress: ArchiveProgress | null;
  errorMessage: string | null;
  recordsArchived: number;
  recordsDeleted: number;
}

export interface ArchiveJob {
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

export function useArchiveData() {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [history, setHistory] = useState<ArchiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetchApi<ArchiveStats>("/api/maintenance/archive/stats");
      setStats(data);
    } catch (err: any) {
      console.error("Erro ao buscar estatisticas:", err);
      setError(err.message || "Erro ao carregar estatísticas de arquivamento");
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await fetchApi<{ isRunning: boolean; job: ActiveJob | null }>("/api/maintenance/archive/progress");
      setActiveJob(data.job);
      return data.isRunning;
    } catch (err: any) {
      console.error("Erro ao buscar progresso:", err);
      setError(err.message || "Erro ao carregar progresso do arquivamento");
      return false;
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await fetchApi<ArchiveJob[]>("/api/maintenance/archive/history?limit=20");
      setHistory(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar historico:", err);
      setError(err.message || "Erro ao carregar histórico de arquivamento");
      setHistory([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.allSettled([fetchStats(), fetchProgress(), fetchHistory()]);
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchProgress, fetchHistory]);

  const startArchive = useCallback(async () => {
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
  }, [fetchProgress]);

  const retryJob = useCallback(async (jobId: number) => {
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
  }, [fetchProgress, fetchHistory]);

  const clearError = useCallback(() => setError(null), []);

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
  }, [fetchStats, fetchProgress, fetchHistory]);

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
  }, [activeJob, fetchStats, fetchProgress, fetchHistory]);

  return {
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
  };
}
