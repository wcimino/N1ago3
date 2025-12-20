import { 
  createSyncLog, 
  updateSyncLog, 
  getLatestSyncLog,
  getLatestAddNewSyncLog,
} from "../storage/zendeskSupportUsersStorage.js";
import {
  SOURCE_TYPE,
  BATCH_SIZE,
  CHECKPOINT_INTERVAL,
  getBaseUrl,
  fetchUsersPage,
  fetchIncrementalUsersPage,
  mapApiUserToDbUser,
} from "./zendeskSupportUsersApiClient.js";
import {
  getIsSyncing,
  setIsSyncing,
  setCurrentSyncId,
  getCancelRequested,
  setCancelRequested,
  setSyncStartTime,
  getCurrentProgress,
  resetProgress,
  formatDuration,
} from "./zendeskSupportUsersProgressTracker.js";
import { resetSyncState } from "./zendeskSupportUsersSyncHelpers.js";
import { runPaginatedSync, type SyncTotals } from "./paginatedSync.js";
import type { SyncType, SyncResult, AddNewSyncResult, AddNewSyncStatus } from "./zendeskSupportUsersSyncTypes.js";

export type { SyncType, SyncResult, AddNewSyncResult, AddNewSyncStatus };

function cleanupSyncState(includeCancelReset = true): void {
  resetSyncState(
    setIsSyncing,
    setCurrentSyncId,
    setSyncStartTime,
    resetProgress,
    includeCancelReset ? setCancelRequested : undefined
  );
}

function createCheckpointHandler(syncLogId: number, metadata?: Record<string, unknown>) {
  return async (pageCount: number, totals: SyncTotals, nextCursor: string | null) => {
    await updateSyncLog(syncLogId, {
      recordsProcessed: totals.processed,
      recordsCreated: totals.created,
      recordsUpdated: totals.updated,
      recordsFailed: totals.failed,
      ...(metadata ? { metadata: { ...metadata, nextCursor } } : {}),
    });
    if (nextCursor) {
      console.log(`[ZendeskSupportUsers] Checkpoint saved at page ${pageCount}`);
    }
  };
}

function createProgressHandler() {
  return (totals: SyncTotals, pageCount: number, estimatedTotal: number) => {
    const progress = getCurrentProgress();
    const pctComplete = estimatedTotal > 0 ? Math.round((totals.processed / estimatedTotal) * 100) : 0;
    console.log(`[ZendeskSupportUsers] Page ${pageCount}: ${totals.processed}/${estimatedTotal} (${pctComplete}%) - ${progress.usersPerMinute} users/min - ETA: ${formatDuration(progress.estimatedTimeRemainingMs)}`);
  };
}

export async function syncZendeskUsers(syncType: SyncType = "full", maxUsers?: number): Promise<{
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
    durationMs: number;
  };
}> {
  if (getIsSyncing()) {
    return { success: false, message: "Sincronização já está em andamento" };
  }
  
  let lastCompletedSync: Awaited<ReturnType<typeof getLatestSyncLog>> = null;
  
  if (syncType === "incremental") {
    lastCompletedSync = await getLatestSyncLog(SOURCE_TYPE);
    if (!lastCompletedSync || lastCompletedSync.status !== "completed") {
      return { success: false, message: "Sincronização incremental requer uma sincronização completa anterior bem-sucedida" };
    }
  }
  
  setIsSyncing(true);
  setCancelRequested(false);
  resetProgress(maxUsers || 0);
  setSyncStartTime(Date.now());
  const startTime = Date.now();
  
  const logSyncType = syncType === "incremental" ? "incremental" : (maxUsers ? "partial" : "full");
  const syncLog = await createSyncLog({
    sourceType: SOURCE_TYPE,
    syncType: logSyncType,
    status: "in_progress",
    startedAt: new Date(),
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsDeleted: 0,
    recordsFailed: 0,
    metadata: { syncType, ...(maxUsers ? { maxUsers } : {}) },
  });
  
  setCurrentSyncId(syncLog.id);
  
  try {
    let result;
    
    if (syncType === "incremental" && lastCompletedSync) {
      const incrementalStartTime = lastCompletedSync.finishedAt 
        ? Math.floor(lastCompletedSync.finishedAt.getTime() / 1000)
        : Math.floor(lastCompletedSync.startedAt.getTime() / 1000);
      
      console.log(`[ZendeskSupportUsers] Starting incremental sync from ${new Date(incrementalStartTime * 1000).toISOString()}...`);
      
      result = await runPaginatedSync(
        `${getBaseUrl()}/api/v2/incremental/users.json?start_time=${incrementalStartTime}`,
        async (url) => {
          const data = await fetchIncrementalUsersPage(url);
          return { items: data.users, nextPage: data.next_page, endOfStream: data.end_of_stream, count: data.count };
        },
        mapApiUserToDbUser,
        {
          maxItems: maxUsers,
          onPageComplete: createCheckpointHandler(syncLog.id),
          onProgress: createProgressHandler(),
        }
      );
    } else {
      console.log(`[ZendeskSupportUsers] Starting full sync...${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
      
      result = await runPaginatedSync(
        `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`,
        async (url) => {
          const data = await fetchUsersPage(url);
          return { items: data.users, nextPage: data.next_page, count: data.count };
        },
        mapApiUserToDbUser,
        {
          maxItems: maxUsers,
          onPageComplete: createCheckpointHandler(syncLog.id),
          onProgress: createProgressHandler(),
        }
      );
    }

    const durationMs = Date.now() - startTime;
    const finalStatus = result.wasCancelled ? "cancelled" : "completed";
    
    await updateSyncLog(syncLog.id, {
      status: finalStatus,
      finishedAt: new Date(),
      durationMs,
      recordsProcessed: result.totals.processed,
      recordsCreated: result.totals.created,
      recordsUpdated: result.totals.updated,
      recordsFailed: result.totals.failed,
    });
    
    const syncTypeLabel = syncType === "incremental" ? "incremental" : "completa";
    const statusLabel = result.wasCancelled ? "cancelada" : "concluída";
    console.log(`[ZendeskSupportUsers] ${syncTypeLabel} sync ${statusLabel}: ${result.totals.processed} processed, ${result.totals.created} created, ${result.totals.updated} updated, ${result.totals.failed} failed in ${durationMs}ms`);
    
    cleanupSyncState(true);
    
    return {
      success: !result.wasCancelled,
      message: result.wasCancelled 
        ? `Sincronização ${syncTypeLabel} cancelada. ${result.totals.processed} registros foram processados.`
        : `Sincronização ${syncTypeLabel} concluída com sucesso`,
      stats: {
        processed: result.totals.processed,
        created: result.totals.created,
        updated: result.totals.updated,
        failed: result.totals.failed,
        durationMs,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await updateSyncLog(syncLog.id, {
      status: "failed",
      finishedAt: new Date(),
      durationMs,
      errorMessage,
    });
    
    console.error(`[ZendeskSupportUsers] Sync failed:`, error);
    cleanupSyncState(false);
    
    return { success: false, message: `Erro na sincronização: ${errorMessage}` };
  }
}

export async function syncNewUsers(maxUsers?: number): Promise<{
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
    durationMs: number;
  };
  nextCursor?: string | null;
  isComplete?: boolean;
}> {
  if (getIsSyncing()) {
    return { success: false, message: "Sincronização já está em andamento" };
  }
  
  setIsSyncing(true);
  setCancelRequested(false);
  resetProgress(maxUsers || 0);
  setSyncStartTime(Date.now());
  const startTime = Date.now();
  
  const lastAddNewSync = await getLatestAddNewSyncLog(SOURCE_TYPE);
  const startCursor = lastAddNewSync?.metadata && typeof lastAddNewSync.metadata === 'object' 
    ? (lastAddNewSync.metadata as { nextCursor?: string }).nextCursor 
    : null;
  
  const syncLog = await createSyncLog({
    sourceType: SOURCE_TYPE,
    syncType: "add-new",
    status: "in_progress",
    startedAt: new Date(),
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsDeleted: 0,
    recordsFailed: 0,
    metadata: { startCursor, ...(maxUsers ? { maxUsers } : {}) },
  });
  
  setCurrentSyncId(syncLog.id);
  
  try {
    const initialUrl = startCursor || `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
    console.log(`[ZendeskSupportUsers] Starting add-new sync...${startCursor ? ` (resuming from cursor)` : ' (from beginning)'}${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
    
    const result = await runPaginatedSync(
      initialUrl,
      async (url) => {
        const data = await fetchUsersPage(url);
        return { items: data.users, nextPage: data.next_page, count: data.count };
      },
      mapApiUserToDbUser,
      {
        maxItems: maxUsers,
        useBuffer: true,
        checkpointInterval: CHECKPOINT_INTERVAL,
        onPageComplete: createCheckpointHandler(syncLog.id, { startCursor }),
        onProgress: createProgressHandler(),
      }
    );
    
    const durationMs = Date.now() - startTime;
    const finalStatus = result.wasCancelled ? "cancelled" : "completed";
    
    await updateSyncLog(syncLog.id, {
      status: finalStatus,
      finishedAt: new Date(),
      durationMs,
      recordsProcessed: result.totals.processed,
      recordsCreated: result.totals.created,
      recordsUpdated: result.totals.updated,
      recordsFailed: result.totals.failed,
      metadata: { startCursor, nextCursor: result.lastCursor, isComplete: result.isComplete, ...(maxUsers ? { maxUsers } : {}) },
    });
    
    const statusLabel = result.wasCancelled ? "cancelada" : (result.isComplete ? "concluída (todos importados)" : "pausada");
    console.log(`[ZendeskSupportUsers] Add-new sync ${statusLabel}: ${result.totals.processed} processed, ${result.totals.created} created, ${result.totals.updated} updated, ${result.totals.failed} failed in ${durationMs}ms`);
    
    cleanupSyncState(true);
    
    return {
      success: !result.wasCancelled,
      message: result.wasCancelled 
        ? `Sincronização cancelada. ${result.totals.processed} registros foram processados. Cursor salvo para continuar.`
        : (result.isComplete 
            ? `Sincronização concluída! Todos os usuários foram importados.`
            : `Sincronização pausada. ${result.totals.processed} registros processados. Clique novamente para continuar.`),
      stats: {
        processed: result.totals.processed,
        created: result.totals.created,
        updated: result.totals.updated,
        failed: result.totals.failed,
        durationMs,
      },
      nextCursor: result.lastCursor,
      isComplete: result.isComplete,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await updateSyncLog(syncLog.id, {
      status: "failed",
      finishedAt: new Date(),
      durationMs,
      errorMessage,
      metadata: { startCursor },
    });
    
    console.error(`[ZendeskSupportUsers] Add-new sync failed:`, error);
    cleanupSyncState(false);
    
    return {
      success: false,
      message: `Erro na sincronização: ${errorMessage}. Cursor salvo, você pode tentar novamente.`,
    };
  }
}
