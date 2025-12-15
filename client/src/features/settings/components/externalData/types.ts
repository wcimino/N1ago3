export type SyncType = "full" | "incremental";

export interface SyncProgress {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentPage: number;
  estimatedTotal: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  currentSyncId: number | null;
  cancelRequested: boolean;
  progress: SyncProgress | null;
  lastSync: {
    id: number;
    status: string;
    syncType: string | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
  } | null;
  totalUsers: number;
  hasCompletedSync: boolean;
}

export interface AddNewSyncStatus {
  hasStarted: boolean;
  isComplete: boolean;
  nextCursor: string | null;
  lastSync: {
    id: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsProcessed: number;
    recordsCreated: number;
  } | null;
}
