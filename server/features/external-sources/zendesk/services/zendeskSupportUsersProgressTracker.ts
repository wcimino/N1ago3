import { getLatestSyncLog, getLatestAddNewSyncLog, getZendeskUsersCount } from "../storage/zendeskSupportUsersStorage.js";
import { SOURCE_TYPE } from "./zendeskSupportUsersApiClient.js";

export interface SyncProgress {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  currentPage: number;
  estimatedTotal: number;
  usersPerMinute: number;
  estimatedTimeRemainingMs: number;
}

let isSyncing = false;
let currentSyncId: number | null = null;
let cancelRequested = false;
let syncStartTime: number = 0;
let currentProgress: SyncProgress = {
  processed: 0,
  created: 0,
  updated: 0,
  failed: 0,
  currentPage: 0,
  estimatedTotal: 0,
  usersPerMinute: 0,
  estimatedTimeRemainingMs: 0,
};

export function getIsSyncing(): boolean {
  return isSyncing;
}

export function setIsSyncing(value: boolean): void {
  isSyncing = value;
}

export function getCurrentSyncId(): number | null {
  return currentSyncId;
}

export function setCurrentSyncId(value: number | null): void {
  currentSyncId = value;
}

export function getCancelRequested(): boolean {
  return cancelRequested;
}

export function setCancelRequested(value: boolean): void {
  cancelRequested = value;
}

export function getSyncStartTime(): number {
  return syncStartTime;
}

export function setSyncStartTime(value: number): void {
  syncStartTime = value;
}

export function getCurrentProgress(): SyncProgress {
  return { ...currentProgress };
}

export function setCurrentProgress(value: SyncProgress): void {
  currentProgress = value;
}

export function resetProgress(estimatedTotal: number = 0): void {
  currentProgress = {
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    currentPage: 0,
    estimatedTotal,
    usersPerMinute: 0,
    estimatedTimeRemainingMs: 0,
  };
}

export function updateProgressMetrics(
  processed: number, 
  created: number, 
  updated: number, 
  failed: number, 
  pageNum: number, 
  estimatedTotal: number
): void {
  const elapsedMs = Date.now() - syncStartTime;
  const usersPerMinute = elapsedMs > 0 ? Math.round((processed / elapsedMs) * 60000) : 0;
  const remaining = Math.max(0, estimatedTotal - processed);
  const estimatedTimeRemainingMs = usersPerMinute > 0 ? Math.round((remaining / usersPerMinute) * 60000) : 0;
  
  currentProgress = {
    processed,
    created,
    updated,
    failed,
    currentPage: pageNum,
    estimatedTotal,
    usersPerMinute,
    estimatedTimeRemainingMs,
  };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "calculating...";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  currentSyncId: number | null;
  cancelRequested: boolean;
  progress: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
    currentPage: number;
    estimatedTotal: number;
    usersPerMinute: number;
    estimatedTimeRemainingMs: number;
    estimatedTimeRemaining: string;
  } | null;
  lastSync: {
    id: number;
    status: string;
    syncType: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
  } | null;
  totalUsers: number;
  hasCompletedSync: boolean;
}> {
  const [lastSyncLog, totalUsers] = await Promise.all([
    getLatestSyncLog(SOURCE_TYPE),
    getZendeskUsersCount(),
  ]);
  
  const hasCompletedSync = lastSyncLog?.status === "completed";
  
  return {
    isSyncing,
    currentSyncId,
    cancelRequested,
    progress: isSyncing ? {
      ...currentProgress,
      estimatedTimeRemaining: formatDuration(currentProgress.estimatedTimeRemainingMs),
    } : null,
    lastSync: lastSyncLog ? {
      id: lastSyncLog.id,
      status: lastSyncLog.status,
      syncType: lastSyncLog.syncType,
      startedAt: lastSyncLog.startedAt,
      finishedAt: lastSyncLog.finishedAt,
      durationMs: lastSyncLog.durationMs,
      recordsProcessed: lastSyncLog.recordsProcessed,
      recordsCreated: lastSyncLog.recordsCreated,
      recordsUpdated: lastSyncLog.recordsUpdated,
      recordsFailed: lastSyncLog.recordsFailed,
    } : null,
    totalUsers,
    hasCompletedSync,
  };
}

export async function getAddNewSyncStatus(): Promise<{
  isSyncing: boolean;
  currentSyncId: number | null;
  cancelRequested: boolean;
  progress: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
    currentPage: number;
    estimatedTotal: number;
    usersPerMinute: number;
    estimatedTimeRemainingMs: number;
    estimatedTimeRemaining: string;
  } | null;
  lastSync: {
    id: number;
    status: string;
    syncType: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
    nextCursor: string | null;
    isComplete: boolean;
  } | null;
  totalUsers: number;
}> {
  const [lastSyncLog, totalUsers] = await Promise.all([
    getLatestAddNewSyncLog(SOURCE_TYPE),
    getZendeskUsersCount(),
  ]);
  
  const nextCursor = lastSyncLog?.metadata && typeof lastSyncLog.metadata === 'object'
    ? (lastSyncLog.metadata as { nextCursor?: string }).nextCursor ?? null
    : null;
    
  const isComplete = lastSyncLog?.metadata && typeof lastSyncLog.metadata === 'object'
    ? (lastSyncLog.metadata as { isComplete?: boolean }).isComplete ?? false
    : false;
  
  return {
    isSyncing,
    currentSyncId,
    cancelRequested,
    progress: isSyncing ? {
      ...currentProgress,
      estimatedTimeRemaining: formatDuration(currentProgress.estimatedTimeRemainingMs),
    } : null,
    lastSync: lastSyncLog ? {
      id: lastSyncLog.id,
      status: lastSyncLog.status,
      syncType: lastSyncLog.syncType,
      startedAt: lastSyncLog.startedAt,
      finishedAt: lastSyncLog.finishedAt,
      durationMs: lastSyncLog.durationMs,
      recordsProcessed: lastSyncLog.recordsProcessed,
      recordsCreated: lastSyncLog.recordsCreated,
      recordsUpdated: lastSyncLog.recordsUpdated,
      recordsFailed: lastSyncLog.recordsFailed,
      nextCursor,
      isComplete,
    } : null,
    totalUsers,
  };
}

export function cancelSync(): { success: boolean; message: string } {
  if (!isSyncing) {
    return {
      success: false,
      message: "Nenhuma sincronização em andamento",
    };
  }
  
  cancelRequested = true;
  return {
    success: true,
    message: "Cancelamento solicitado. A sincronização será interrompida após o batch atual.",
  };
}
