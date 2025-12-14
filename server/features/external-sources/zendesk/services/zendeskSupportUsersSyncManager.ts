import { 
  upsertZendeskUsersBatch, 
  createSyncLog, 
  updateSyncLog, 
  getLatestSyncLog,
  getLatestAddNewSyncLog,
} from "../storage/zendeskSupportUsersStorage.js";
import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";
import {
  SOURCE_TYPE,
  BATCH_SIZE,
  DB_BATCH_SIZE,
  CHECKPOINT_INTERVAL,
  getBaseUrl,
  fetchUsersPage,
  fetchIncrementalUsersPage,
  mapApiUserToDbUser,
  sleep,
} from "./zendeskSupportUsersApiClient.js";
import {
  getIsSyncing,
  setIsSyncing,
  getCurrentSyncId,
  setCurrentSyncId,
  getCancelRequested,
  setCancelRequested,
  setSyncStartTime,
  getCurrentProgress,
  setCurrentProgress,
  resetProgress,
  updateProgressMetrics,
  formatDuration,
} from "./zendeskSupportUsersProgressTracker.js";

export type SyncType = "full" | "incremental";

async function flushBufferWithRetry(
  buffer: InsertZendeskSupportUser[], 
  maxRetries = 3
): Promise<{ created: number; updated: number; success: boolean }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await upsertZendeskUsersBatch(buffer);
      return { ...result, success: true };
    } catch (err) {
      console.error(`[ZendeskSupportUsers] Error upserting batch (attempt ${attempt}/${maxRetries}):`, err);
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }
  return { created: 0, updated: 0, success: false };
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
    return {
      success: false,
      message: "Sincronização já está em andamento",
    };
  }
  
  let lastCompletedSync: Awaited<ReturnType<typeof getLatestSyncLog>> = null;
  
  if (syncType === "incremental") {
    lastCompletedSync = await getLatestSyncLog(SOURCE_TYPE);
    if (!lastCompletedSync || lastCompletedSync.status !== "completed") {
      return {
        success: false,
        message: "Sincronização incremental requer uma sincronização completa anterior bem-sucedida",
      };
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
  
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let wasCancelled = false;
  
  try {
    if (syncType === "incremental" && lastCompletedSync) {
      const incrementalStartTime = lastCompletedSync.finishedAt 
        ? Math.floor(lastCompletedSync.finishedAt.getTime() / 1000)
        : Math.floor(lastCompletedSync.startedAt.getTime() / 1000);
      
      console.log(`[ZendeskSupportUsers] Starting incremental sync from ${new Date(incrementalStartTime * 1000).toISOString()}...`);
      
      let url: string | null = `${getBaseUrl()}/api/v2/incremental/users.json?start_time=${incrementalStartTime}`;
      let pageCount = 0;
      
      while (url && !getCancelRequested()) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching incremental page ${pageCount}...`);
        const progress = getCurrentProgress();
        setCurrentProgress({ ...progress, currentPage: pageCount });
        
        const data = await fetchIncrementalUsersPage(url);
        
        if (data.users.length === 0 || data.end_of_stream) {
          if (data.users.length > 0) {
            const usersToUpsert = data.users.map(mapApiUserToDbUser);
            try {
              const { created, updated } = await upsertZendeskUsersBatch(usersToUpsert);
              totalCreated += created;
              totalUpdated += updated;
              totalProcessed += usersToUpsert.length;
            } catch (err) {
              console.error(`[ZendeskSupportUsers] Error upserting batch:`, err);
              totalFailed += usersToUpsert.length;
            }
          }
          break;
        }
        
        const usersToUpsert = data.users.map(mapApiUserToDbUser);
        
        try {
          const { created, updated } = await upsertZendeskUsersBatch(usersToUpsert);
          totalCreated += created;
          totalUpdated += updated;
          totalProcessed += usersToUpsert.length;
        } catch (err) {
          console.error(`[ZendeskSupportUsers] Error upserting batch:`, err);
          totalFailed += usersToUpsert.length;
        }
        
        updateProgressMetrics(totalProcessed, totalCreated, totalUpdated, totalFailed, pageCount, getCurrentProgress().estimatedTotal);
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url && !getCancelRequested()) {
          await sleep(100);
        }
      }
      
      if (getCancelRequested()) {
        wasCancelled = true;
        console.log(`[ZendeskSupportUsers] Sync cancelled after ${totalProcessed} records`);
      }
    } else {
      console.log(`[ZendeskSupportUsers] Starting full sync...${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
      
      let url: string | null = `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
      let pageCount = 0;
      let estimatedTotal = maxUsers || 0;
      
      while (url && (!maxUsers || totalProcessed < maxUsers) && !getCancelRequested()) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching page ${pageCount}...`);
        
        const data = await fetchUsersPage(url);
        
        if (estimatedTotal === 0 && data.count) {
          estimatedTotal = maxUsers ? Math.min(maxUsers, data.count) : data.count;
        }
        
        if (data.users.length === 0) {
          break;
        }
        
        let usersToProcess = data.users;
        if (maxUsers && totalProcessed + usersToProcess.length > maxUsers) {
          usersToProcess = usersToProcess.slice(0, maxUsers - totalProcessed);
        }
        const usersToUpsert = usersToProcess.map(mapApiUserToDbUser);
        
        try {
          const { created, updated } = await upsertZendeskUsersBatch(usersToUpsert);
          totalCreated += created;
          totalUpdated += updated;
          totalProcessed += usersToUpsert.length;
        } catch (err) {
          console.error(`[ZendeskSupportUsers] Error upserting batch:`, err);
          totalFailed += usersToUpsert.length;
        }
        
        updateProgressMetrics(totalProcessed, totalCreated, totalUpdated, totalFailed, pageCount, estimatedTotal);
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url && !getCancelRequested()) {
          await sleep(100);
        }
      }
      
      if (getCancelRequested()) {
        wasCancelled = true;
        console.log(`[ZendeskSupportUsers] Sync cancelled after ${totalProcessed} records`);
      }
    }
    
    const durationMs = Date.now() - startTime;
    const finalStatus = wasCancelled ? "cancelled" : "completed";
    
    await updateSyncLog(syncLog.id, {
      status: finalStatus,
      finishedAt: new Date(),
      durationMs,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed,
    });
    
    const syncTypeLabel = syncType === "incremental" ? "incremental" : "completa";
    const statusLabel = wasCancelled ? "cancelada" : "concluída";
    console.log(`[ZendeskSupportUsers] ${syncTypeLabel} sync ${statusLabel}: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed in ${durationMs}ms`);
    
    setIsSyncing(false);
    setCurrentSyncId(null);
    setCancelRequested(false);
    setSyncStartTime(0);
    resetProgress(0);
    
    return {
      success: !wasCancelled,
      message: wasCancelled 
        ? `Sincronização ${syncTypeLabel} cancelada. ${totalProcessed} registros foram processados.`
        : `Sincronização ${syncTypeLabel} concluída com sucesso`,
      stats: {
        processed: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
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
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed,
    });
    
    console.error(`[ZendeskSupportUsers] Sync failed:`, error);
    
    setIsSyncing(false);
    setCurrentSyncId(null);
    setSyncStartTime(0);
    resetProgress(0);
    
    return {
      success: false,
      message: `Erro na sincronização: ${errorMessage}`,
    };
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
    return {
      success: false,
      message: "Sincronização já está em andamento",
    };
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
  
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let wasCancelled = false;
  let nextCursor: string | null = null;
  let isComplete = false;
  
  let userBuffer: InsertZendeskSupportUser[] = [];
  let lastPersistedCursor: string | null = startCursor ?? null;
  
  try {
    console.log(`[ZendeskSupportUsers] Starting add-new sync...${startCursor ? ` (resuming from cursor)` : ' (from beginning)'}${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
    
    let url: string | null = startCursor || `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
    let pageCount = 0;
    let estimatedTotal = maxUsers || 0;
    let lastCheckpointPage = 0;
    
    while (url && (!maxUsers || totalProcessed < maxUsers) && !getCancelRequested()) {
      pageCount++;
      
      const data = await fetchUsersPage(url);
      
      if (estimatedTotal === 0 && data.count) {
        estimatedTotal = maxUsers ? Math.min(maxUsers, data.count) : data.count;
      }
      
      if (data.users.length === 0) {
        isComplete = true;
        break;
      }
      
      let usersToProcess = data.users;
      if (maxUsers && totalProcessed + usersToProcess.length > maxUsers) {
        usersToProcess = usersToProcess.slice(0, maxUsers - totalProcessed);
      }
      
      userBuffer.push(...usersToProcess.map(mapApiUserToDbUser));
      
      if (userBuffer.length >= DB_BATCH_SIZE || !data.next_page) {
        const { created, updated, success } = await flushBufferWithRetry(userBuffer);
        
        if (success) {
          totalCreated += created;
          totalUpdated += updated;
          totalProcessed += userBuffer.length;
          userBuffer = [];
          
          lastPersistedCursor = data.next_page;
          nextCursor = data.next_page;
          
          const currentProgress = getCurrentProgress();
          const pctComplete = estimatedTotal > 0 ? Math.round((totalProcessed / estimatedTotal) * 100) : 0;
          console.log(`[ZendeskSupportUsers] Page ${pageCount}: ${totalProcessed}/${estimatedTotal} (${pctComplete}%) - ${currentProgress.usersPerMinute} users/min - ETA: ${formatDuration(currentProgress.estimatedTimeRemainingMs)}`);
        } else {
          console.error(`[ZendeskSupportUsers] Failed to persist batch after retries. Stopping sync to prevent data loss.`);
          totalFailed += userBuffer.length;
          nextCursor = lastPersistedCursor;
          break;
        }
      }
      
      updateProgressMetrics(totalProcessed, totalCreated, totalUpdated, totalFailed, pageCount, estimatedTotal);
      
      if (pageCount - lastCheckpointPage >= CHECKPOINT_INTERVAL) {
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
          metadata: { startCursor, nextCursor: lastPersistedCursor, ...(maxUsers ? { maxUsers } : {}) },
        });
        lastCheckpointPage = pageCount;
        console.log(`[ZendeskSupportUsers] Checkpoint saved at page ${pageCount}, cursor: ${lastPersistedCursor?.slice(0, 50)}...`);
      }
      
      url = data.next_page;
      
      if (!url) {
        isComplete = true;
      }
      
      if (url && !getCancelRequested()) {
        await sleep(100);
      }
    }
    
    if (userBuffer.length > 0) {
      const { created, updated, success } = await flushBufferWithRetry(userBuffer);
      if (success) {
        totalCreated += created;
        totalUpdated += updated;
        totalProcessed += userBuffer.length;
        userBuffer = [];
      } else {
        console.error(`[ZendeskSupportUsers] Failed to persist final batch after retries.`);
        totalFailed += userBuffer.length;
        nextCursor = lastPersistedCursor;
      }
    }
    
    if (getCancelRequested()) {
      wasCancelled = true;
      console.log(`[ZendeskSupportUsers] Add-new sync cancelled after ${totalProcessed} records`);
    }
    
    const durationMs = Date.now() - startTime;
    const finalStatus = wasCancelled ? "cancelled" : "completed";
    
    await updateSyncLog(syncLog.id, {
      status: finalStatus,
      finishedAt: new Date(),
      durationMs,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed,
      metadata: { startCursor, nextCursor, isComplete, ...(maxUsers ? { maxUsers } : {}) },
    });
    
    const statusLabel = wasCancelled ? "cancelada" : (isComplete ? "concluída (todos importados)" : "pausada");
    console.log(`[ZendeskSupportUsers] Add-new sync ${statusLabel}: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed in ${durationMs}ms`);
    
    setIsSyncing(false);
    setCurrentSyncId(null);
    setCancelRequested(false);
    setSyncStartTime(0);
    resetProgress(0);
    
    return {
      success: !wasCancelled,
      message: wasCancelled 
        ? `Sincronização cancelada. ${totalProcessed} registros foram processados. Cursor salvo para continuar.`
        : (isComplete 
            ? `Sincronização concluída! Todos os usuários foram importados.`
            : `Sincronização pausada. ${totalProcessed} registros processados. Clique novamente para continuar.`),
      stats: {
        processed: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
        durationMs,
      },
      nextCursor,
      isComplete,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (userBuffer.length > 0) {
      console.log(`[ZendeskSupportUsers] Attempting to flush ${userBuffer.length} buffered users before error exit...`);
      const { created, updated, success } = await flushBufferWithRetry(userBuffer);
      if (success) {
        totalCreated += created;
        totalUpdated += updated;
        totalProcessed += userBuffer.length;
        console.log(`[ZendeskSupportUsers] Successfully saved ${userBuffer.length} buffered users before exit.`);
      } else {
        console.error(`[ZendeskSupportUsers] Failed to save buffered users. Data preserved at cursor: ${lastPersistedCursor}`);
        totalFailed += userBuffer.length;
      }
    }
    
    await updateSyncLog(syncLog.id, {
      status: "failed",
      finishedAt: new Date(),
      durationMs,
      errorMessage,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed,
      metadata: { startCursor, nextCursor: lastPersistedCursor, ...(maxUsers ? { maxUsers } : {}) },
    });
    
    console.error(`[ZendeskSupportUsers] Add-new sync failed:`, error);
    
    setIsSyncing(false);
    setCurrentSyncId(null);
    setSyncStartTime(0);
    resetProgress(0);
    
    return {
      success: false,
      message: `Erro na sincronização: ${errorMessage}. Cursor salvo, você pode tentar novamente.`,
      nextCursor: lastPersistedCursor,
    };
  }
}

export async function getAddNewSyncStatus(): Promise<{
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
}> {
  const lastAddNewSync = await getLatestAddNewSyncLog(SOURCE_TYPE);
  
  if (!lastAddNewSync) {
    return {
      hasStarted: false,
      isComplete: false,
      nextCursor: null,
      lastSync: null,
    };
  }
  
  const metadata = lastAddNewSync.metadata as { nextCursor?: string; isComplete?: boolean } | null;
  
  return {
    hasStarted: true,
    isComplete: metadata?.isComplete ?? false,
    nextCursor: metadata?.nextCursor ?? null,
    lastSync: {
      id: lastAddNewSync.id,
      status: lastAddNewSync.status,
      startedAt: lastAddNewSync.startedAt,
      finishedAt: lastAddNewSync.finishedAt,
      recordsProcessed: lastAddNewSync.recordsProcessed,
      recordsCreated: lastAddNewSync.recordsCreated,
    },
  };
}
