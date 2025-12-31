import { Loader2 } from "lucide-react";
import { formatNumber } from "../../../../lib/formatters";
import type { ActiveJob } from "../../hooks/useArchiveData";

interface ActiveJobProgressProps {
  job: ActiveJob;
  formatDate: (dateStr: string | null) => string;
}

export function ActiveJobProgress({ job, formatDate }: ActiveJobProgressProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <h2 className="text-lg font-semibold text-blue-900">Arquivamento em Execucao</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-blue-600">Tabela</p>
          <p className="font-medium">{job.tableName}</p>
        </div>
        <div>
          <p className="text-blue-600">Data</p>
          <p className="font-medium">{formatDate(job.archiveDate)}</p>
        </div>
        <div>
          <p className="text-blue-600">Fase</p>
          <p className="font-medium capitalize">{job.progress?.phase || "Iniciando..."}</p>
        </div>
        <div>
          <p className="text-blue-600">Processados</p>
          <p className="font-medium">{formatNumber(job.progress?.recordsProcessed || 0)}</p>
        </div>
      </div>
    </div>
  );
}
