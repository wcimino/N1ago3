import type { SyncProgress } from "./types";
import { getProgressPercentage } from "./utils";

interface SyncProgressSectionProps {
  progress: SyncProgress;
  cancelRequested: boolean;
}

export function SyncProgressSection({ progress, cancelRequested }: SyncProgressSectionProps) {
  const percentage = getProgressPercentage(progress.processed, progress.estimatedTotal);

  return (
    <div className="bg-white rounded-lg p-4 border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Progresso da sincronização
        </span>
        <span className="text-sm text-gray-500">
          {progress.processed.toLocaleString("pt-BR")} 
          {progress.estimatedTotal > 0 && (
            <> / {progress.estimatedTotal.toLocaleString("pt-BR")}</>
          )}
          {" "}usuários
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div 
          className="bg-orange-500 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Página {progress.currentPage} | {" "}
          {progress.created.toLocaleString("pt-BR")} novos, {" "}
          {progress.updated.toLocaleString("pt-BR")} atualizados
          {progress.failed > 0 && (
            <span className="text-red-500">
              , {progress.failed.toLocaleString("pt-BR")} com erro
            </span>
          )}
        </span>
        <span className="font-medium text-orange-600">
          {percentage}%
        </span>
      </div>
      
      {cancelRequested && (
        <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
          Cancelamento solicitado. Aguardando finalização do batch atual...
        </div>
      )}
    </div>
  );
}
