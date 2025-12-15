import type { SyncStatus } from "./types";
import { getStatusIcon, getStatusText, formatDuration } from "./utils";

interface SyncStatusCardsProps {
  syncStatus: SyncStatus;
  formatShortDateTime: (date: string) => string;
}

export function SyncStatusCards({ syncStatus, formatShortDateTime }: SyncStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white rounded-lg p-3 border">
        <div className="text-2xl font-bold text-gray-900">
          {syncStatus.totalUsers.toLocaleString("pt-BR")}
        </div>
        <div className="text-xs text-gray-500">Usuários sincronizados</div>
      </div>

      {syncStatus.lastSync && (
        <>
          <div className="bg-white rounded-lg p-3 border">
            <div className="flex items-center gap-2">
              {getStatusIcon(syncStatus.isSyncing ? "in_progress" : syncStatus.lastSync.status)}
              <span className="text-sm font-medium text-gray-900">
                {syncStatus.isSyncing ? "Em andamento" : getStatusText(syncStatus.lastSync.status)}
              </span>
            </div>
            <div className="text-xs text-gray-500">Status</div>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <div className="text-sm font-medium text-gray-900">
              {formatShortDateTime(syncStatus.lastSync.startedAt)}
            </div>
            <div className="text-xs text-gray-500">Última sincronização</div>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <div className="text-sm font-medium text-gray-900">
              {formatDuration(syncStatus.lastSync.durationMs)}
            </div>
            <div className="text-xs text-gray-500">Duração</div>
          </div>
        </>
      )}
    </div>
  );
}
