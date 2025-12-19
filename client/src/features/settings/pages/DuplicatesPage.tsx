import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, Trash2, RefreshCw, Database, Copy } from "lucide-react";
import { apiRequest, fetchApi } from "../../../lib/queryClient";
import { useConfirmation } from "../../../shared/hooks";
import { ConfirmModal } from "../../../shared/components";

interface DuplicateStats {
  totalEvents: number;
  uniqueEvents: number;
  duplicateCount: number;
  duplicateGroups: number;
}

interface DuplicateGroup {
  source: string;
  sourceEventId: string;
  count: number;
  ids: number[];
  keepId: number;
  deleteIds: number[];
}

interface CleanupResult {
  message: string;
  dryRun: boolean;
  deletedCount: number;
  groups: number;
  deletedIds: number[];
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function DuplicatesPage() {
  const [, navigate] = useLocation();
  const confirmation = useConfirmation();
  const [stats, setStats] = useState<DuplicateStats | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  const fetchStats = async () => {
    try {
      const data = await fetchApi<DuplicateStats>("/api/maintenance/duplicates/stats");
      setStats(data);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  };

  const fetchDuplicates = async () => {
    try {
      const data = await fetchApi<DuplicateGroup[]>("/api/maintenance/duplicates/list?limit=50");
      setDuplicates(data);
    } catch (error) {
      console.error("Erro ao buscar duplicados:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchDuplicates()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleDryRun = async () => {
    setCleaning(true);
    try {
      const res = await apiRequest("POST", "/api/maintenance/duplicates/cleanup?dryRun=true");
      const result: CleanupResult = await res.json();
      setLastResult(result);
    } catch (error) {
      console.error("Erro na simulação:", error);
    }
    setCleaning(false);
  };

  const executeCleanup = async () => {
    setCleaning(true);
    try {
      const res = await apiRequest("POST", "/api/maintenance/duplicates/cleanup?dryRun=false");
      const result: CleanupResult = await res.json();
      setLastResult(result);
      await Promise.all([fetchStats(), fetchDuplicates()]);
    } catch (error) {
      console.error("Erro na limpeza:", error);
    }
    setCleaning(false);
  };

  const handleCleanup = () => {
    confirmation.confirm({
      title: "Remover duplicados",
      message: "Tem certeza que deseja remover os duplicados? Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      variant: "danger",
      onConfirm: executeCleanup,
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchDuplicates()]);
    setLoading(false);
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Limpeza de Duplicados</h1>
          <p className="text-gray-600">Identifique e remova eventos duplicados na tabela events_standard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Eventos</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.totalEvents) : "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Eventos Únicos</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.uniqueEvents) : "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Copy className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Duplicados</p>
              <p className="text-xl font-bold text-red-600">{stats ? formatNumber(stats.duplicateCount) : "-"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Grupos c/ Duplicados</p>
              <p className="text-xl font-bold">{stats ? formatNumber(stats.duplicateGroups) : "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ações</h2>
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
            onClick={handleDryRun}
            disabled={cleaning || !stats?.duplicateCount}
            className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            Simular Limpeza
          </button>

          <button
            onClick={handleCleanup}
            disabled={cleaning || !stats?.duplicateCount}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {cleaning ? "Limpando..." : "Remover Duplicados"}
          </button>
        </div>

        {lastResult && (
          <div className={`mt-4 p-4 rounded-lg ${lastResult.dryRun ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"} border`}>
            <p className="font-medium">{lastResult.message}</p>
            <p className="text-sm text-gray-600 mt-1">
              {lastResult.dryRun ? "Nenhum dado foi alterado" : `${formatNumber(lastResult.deletedCount)} registros removidos`}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Grupos de Duplicados (top 50)</h2>
          <p className="text-sm text-gray-600">O primeiro ID de cada grupo será mantido, os demais serão removidos</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : duplicates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum duplicado encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Event ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ID Mantido</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IDs a Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {duplicates.map((group, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{group.source}</td>
                    <td className="px-4 py-3 text-sm font-mono text-xs">{group.sourceEventId}</td>
                    <td className="px-4 py-3 text-sm text-right">{group.count}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{group.keepId}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-mono text-xs">
                      {group.deleteIds.slice(0, 5).join(", ")}
                      {group.deleteIds.length > 5 && ` +${group.deleteIds.length - 5}`}
                    </td>
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
