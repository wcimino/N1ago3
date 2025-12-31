import { Archive, Database, CheckCircle, XCircle } from "lucide-react";
import { formatNumber } from "../../../../lib/formatters";
import type { ArchiveStats } from "../../hooks/useArchiveData";

interface ArchiveStatsCardsProps {
  stats: ArchiveStats | null;
}

export function ArchiveStatsCards({ stats }: ArchiveStatsCardsProps) {
  return (
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
  );
}
