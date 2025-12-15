export type SyncType = "full" | "incremental";

export interface SyncStats {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  durationMs: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  stats?: SyncStats;
}

export interface AddNewSyncResult extends SyncResult {
  nextCursor?: string | null;
  isComplete?: boolean;
}

export interface AddNewSyncStatus {
  hasStarted: boolean;
  isComplete: boolean;
  nextCursor: string | null;
  lastSync: {
    id: number;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    recordsProcessed: number;
    recordsCreated: number;
  } | null;
}
