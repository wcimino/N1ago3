import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Users, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest, fetchApi } from "../../lib/queryClient";

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

export function MaintenanceTab() {
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

  const renderProgressCard = (type: ReprocessingType, title: string, icon: React.ReactNode) => {
    const p = progress?.[type];
    const isRunning = p?.status === "running";
    const isCompleted = p?.status === "completed";
    const progressPercent = p && p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            {icon}
            {title}
          </h3>
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
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
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
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            Último erro: {p.lastError}
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => handleStart(type)}
              disabled={loading[type] || isCompleted}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {p?.status === "paused" ? "Continuar" : "Iniciar"}
            </button>
          ) : (
            <button
              onClick={() => handleStop(type)}
              disabled={loading[type]}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}
          <button
            onClick={() => handleReset(type)}
            disabled={loading[type] || isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Resetar
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          {type === "users"
            ? "Reprocessa todos os webhooks para extrair e atualizar dados de usuários na tabela users_standard."
            : "Reprocessa todos os webhooks para extrair e atualizar dados de organizações na tabela organizations_standard."}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Atenção:</strong> O reprocessamento percorre todo o histórico de webhooks e pode levar bastante tempo em bancos de dados grandes. O processo roda 1 item por vez para não sobrecarregar o sistema.
        </p>
      </div>

      {renderProgressCard("users", "Reprocessar Usuários", <Users className="w-5 h-5" />)}
      {renderProgressCard("organizations", "Reprocessar Organizações", <Building2 className="w-5 h-5" />)}
    </div>
  );
}
