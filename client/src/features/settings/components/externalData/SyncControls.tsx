import { RefreshCw, X, Loader2, ArrowRight } from "lucide-react";
import type { SyncType, SyncStatus } from "./types";

interface SyncControlsProps {
  syncStatus: SyncStatus;
  syncType: SyncType;
  maxUsers: string;
  onSyncTypeChange: (type: SyncType) => void;
  onMaxUsersChange: (value: string) => void;
  onSync: () => void;
  onCancel: () => void;
  onNavigate: () => void;
  isSyncPending: boolean;
  isCancelPending: boolean;
}

export function SyncControls({ 
  syncStatus,
  syncType,
  maxUsers,
  onSyncTypeChange,
  onMaxUsersChange,
  onSync, 
  onCancel, 
  onNavigate,
  isSyncPending,
  isCancelPending
}: SyncControlsProps) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">Tipo de sincronização:</label>
          <select
            value={syncType}
            onChange={(e) => onSyncTypeChange(e.target.value as SyncType)}
            disabled={!syncStatus.hasCompletedSync && syncType === "incremental"}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
          >
            <option value="full">Completa</option>
            <option value="incremental" disabled={!syncStatus.hasCompletedSync}>
              Incremental {!syncStatus.hasCompletedSync && "(requer sync anterior)"}
            </option>
          </select>
        </div>

        {syncType === "full" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Limite:</label>
            <input
              type="number"
              value={maxUsers}
              onChange={(e) => onMaxUsersChange(e.target.value)}
              placeholder="Ex: 1000"
              className="w-28 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              min="1"
              max="1000000"
            />
            <span className="text-xs text-gray-500">(vazio = todos)</span>
          </div>
        )}
      </div>

      {syncType === "incremental" && (
        <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          Sincronização incremental busca apenas usuários modificados desde a última sincronização completa.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {syncStatus.isSyncing ? (
          <button
            onClick={onCancel}
            disabled={syncStatus.cancelRequested || isCancelPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncStatus.cancelRequested || isCancelPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Cancelar sincronização
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onSync}
            disabled={isSyncPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            {syncType === "incremental" ? "Sincronizar alterações" : "Sincronizar agora"}
          </button>
        )}

        <button
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Ver usuários
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
