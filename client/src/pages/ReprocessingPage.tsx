import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Pause, RotateCcw, Users, Building2, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest, fetchApi } from "../lib/queryClient";

type ReprocessingType = "users" | "organizations";

interface ReprocessingProgress {
  type: ReprocessingType;
  status: "idle" | "running" | "paused" | "completed" | "error";
  total: number;
  processed: number;
  successful: number;
  errors: number;
  currentId: number | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface AllProgress {
  users: ReprocessingProgress;
  organizations: ReprocessingProgress;
}

export function ReprocessingPage() {
  const [, navigate] = useLocation();
  const [progress, setProgress] = useState<AllProgress | null>(null);
  const [loading, setLoading] = useState<Record<ReprocessingType, boolean>>({
    users: false,
    organizations: false,
  });

  const fetchProgress = async () => {
    try {
      const data = await fetchApi<AllProgress>("/api/maintenance/reprocessing/progress");
      setProgress(data);
    } catch (error) {
      console.error("Erro ao buscar progresso:", error);
    }
  };

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (type: ReprocessingType) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      await apiRequest("POST", `/api/maintenance/reprocessing/start/${type}`);
      await fetchProgress();
    } catch (error) {
      console.error("Erro ao iniciar:", error);
    }
    setLoading((prev) => ({ ...prev, [type]: false }));
  };

  const handleStop = async (type: ReprocessingType) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      await apiRequest("POST", `/api/maintenance/reprocessing/stop/${type}`);
      await fetchProgress();
    } catch (error) {
      console.error("Erro ao pausar:", error);
    }
    setLoading((prev) => ({ ...prev, [type]: false }));
  };

  const handleReset = async (type: ReprocessingType) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      await apiRequest("POST", `/api/maintenance/reprocessing/reset/${type}`);
      await fetchProgress();
    } catch (error) {
      console.error("Erro ao resetar:", error);
    }
    setLoading((prev) => ({ ...prev, [type]: false }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      case "paused":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running":
        return "Executando";
      case "completed":
        return "Concluído";
      case "paused":
        return "Pausado";
      case "error":
        return "Erro";
      default:
        return "Aguardando";
    }
  };

  const renderProgressCard = (type: ReprocessingType, title: string, description: string, icon: React.ReactNode) => {
    const p = progress?.[type];
    const isRunning = p?.status === "running";
    const isCompleted = p?.status === "completed";
    const progressPercent = p && p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(p?.status || "idle")}`}>
            {getStatusLabel(p?.status || "idle")}
          </span>
        </div>

        {p && p.total > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{p.processed.toLocaleString()} de {p.total.toLocaleString()}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  isCompleted ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {p && (p.successful > 0 || p.errors > 0) && (
          <div className="flex gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>{p.successful.toLocaleString()} sucesso</span>
            </div>
            {p.errors > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{p.errors.toLocaleString()} erros</span>
              </div>
            )}
          </div>
        )}

        {p?.lastError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Último erro:</strong> {p.lastError}
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => handleStart(type)}
              disabled={loading[type] || isCompleted}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              {p?.status === "paused" ? "Continuar" : "Iniciar"}
            </button>
          ) : (
            <button
              onClick={() => handleStop(type)}
              disabled={loading[type]}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}
          <button
            onClick={() => handleReset(type)}
            disabled={loading[type] || isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/settings")}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reprocessamento de Dados</h1>
          <p className="text-gray-600 mt-1">Reprocesse webhooks para atualizar dados de usuários e organizações</p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Atenção:</strong> O reprocessamento percorre todo o histórico de webhooks e pode levar bastante tempo em bancos de dados grandes. O processo roda 1 item por vez para não sobrecarregar o sistema.
        </p>
      </div>

      <div className="space-y-4">
        {renderProgressCard(
          "users",
          "Reprocessar Usuários",
          "Extrai e atualiza dados de usuários na tabela users_standard",
          <Users className="w-5 h-5 text-blue-600" />
        )}
        {renderProgressCard(
          "organizations",
          "Reprocessar Organizações",
          "Extrai e atualiza dados de organizações na tabela organizations_standard",
          <Building2 className="w-5 h-5 text-blue-600" />
        )}
      </div>
    </div>
  );
}
