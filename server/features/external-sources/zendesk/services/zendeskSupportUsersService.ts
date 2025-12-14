import { 
  upsertZendeskUsersBatch, 
  createSyncLog, 
  updateSyncLog, 
  getLatestSyncLog,
  getLatestAddNewSyncLog,
  getZendeskUsersCount,
  type ZendeskUserFilters,
  listZendeskUsers
} from "../storage/zendeskSupportUsersStorage.js";
import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";

const ZENDESK_SUBDOMAIN = "movilepay";
const SOURCE_TYPE = "zendesk-support-users";
const BATCH_SIZE = 100;
const DB_BATCH_SIZE = 500;
const CHECKPOINT_INTERVAL = 10;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

interface ZendeskUserApiResponse {
  id: number;
  url: string;
  name: string;
  email: string | null;
  phone: string | null;
  shared_phone_number: boolean | null;
  alias: string | null;
  role: string;
  role_type: number | null;
  custom_role_id: number | null;
  verified: boolean;
  active: boolean;
  suspended: boolean;
  moderator: boolean;
  restricted_agent: boolean;
  organization_id: number | null;
  default_group_id: number | null;
  time_zone: string;
  iana_time_zone: string;
  locale: string;
  locale_id: number;
  details: string | null;
  notes: string | null;
  signature: string | null;
  tags: string[];
  external_id: string | null;
  ticket_restriction: string | null;
  only_private_comments: boolean;
  chat_only: boolean;
  shared: boolean;
  shared_agent: boolean;
  two_factor_auth_enabled: boolean | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  user_fields: Record<string, unknown>;
  photo: Record<string, unknown> | null;
}

interface ZendeskUsersListResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface ZendeskIncrementalUsersResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  end_of_stream: boolean;
  end_time: number;
  count: number;
}

export type SyncType = "full" | "incremental";

let isSyncing = false;
let currentSyncId: number | null = null;
let cancelRequested = false;
let syncStartTime: number = 0;
let currentProgress = {
  processed: 0,
  created: 0,
  updated: 0,
  failed: 0,
  currentPage: 0,
  estimatedTotal: 0,
  usersPerMinute: 0,
  estimatedTimeRemainingMs: 0,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
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

async function fetchWithRetry<T>(
  url: string, 
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        console.log(`[ZendeskSupportUsers] Rate limited (429). Waiting ${waitMs}ms before retry ${attempt}/${retries}...`);
        await sleep(waitMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }
      
      if (response.status >= 500) {
        const errorBody = await response.text();
        console.log(`[ZendeskSupportUsers] Server error (${response.status}). Retrying ${attempt}/${retries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        lastError = new Error(`Zendesk API error: ${response.status} ${response.statusText} - ${errorBody}`);
        continue;
      }
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Zendesk API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log(`[ZendeskSupportUsers] Network error. Retrying ${attempt}/${retries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        lastError = error as Error;
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function getAuthHeader(): string {
  const email = process.env.ZENDESK_SUPPORT_EMAIL;
  const apiToken = process.env.ZENDESK_SUPPORT_API_TOKEN;
  
  if (!email || !apiToken) {
    throw new Error("Missing ZENDESK_SUPPORT_EMAIL or ZENDESK_SUPPORT_API_TOKEN environment variables");
  }
  
  const credentials = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  return `Basic ${credentials}`;
}

function getBaseUrl(): string {
  return `https://${ZENDESK_SUBDOMAIN}.zendesk.com`;
}

function mapApiUserToDbUser(apiUser: ZendeskUserApiResponse): InsertZendeskSupportUser {
  return {
    zendeskId: apiUser.id,
    url: apiUser.url,
    name: apiUser.name,
    email: apiUser.email,
    phone: apiUser.phone,
    sharedPhoneNumber: apiUser.shared_phone_number,
    alias: apiUser.alias,
    role: apiUser.role,
    roleType: apiUser.role_type,
    customRoleId: apiUser.custom_role_id,
    verified: apiUser.verified,
    active: apiUser.active,
    suspended: apiUser.suspended,
    moderator: apiUser.moderator,
    restrictedAgent: apiUser.restricted_agent,
    organizationId: apiUser.organization_id,
    defaultGroupId: apiUser.default_group_id,
    timeZone: apiUser.time_zone,
    ianaTimeZone: apiUser.iana_time_zone,
    locale: apiUser.locale,
    localeId: apiUser.locale_id,
    details: apiUser.details,
    notes: apiUser.notes,
    signature: apiUser.signature,
    tags: apiUser.tags,
    externalId: apiUser.external_id,
    ticketRestriction: apiUser.ticket_restriction,
    onlyPrivateComments: apiUser.only_private_comments,
    chatOnly: apiUser.chat_only,
    shared: apiUser.shared,
    sharedAgent: apiUser.shared_agent,
    twoFactorAuthEnabled: apiUser.two_factor_auth_enabled,
    zendeskCreatedAt: apiUser.created_at ? new Date(apiUser.created_at) : null,
    zendeskUpdatedAt: apiUser.updated_at ? new Date(apiUser.updated_at) : null,
    lastLoginAt: apiUser.last_login_at ? new Date(apiUser.last_login_at) : null,
    userFields: apiUser.user_fields,
    photo: apiUser.photo,
    syncedAt: new Date(),
  };
}

async function fetchUsersPage(url: string): Promise<ZendeskUsersListResponse> {
  console.log(`[ZendeskSupportUsers] Fetching URL: ${url}`);
  
  return fetchWithRetry<ZendeskUsersListResponse>(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
}

async function fetchIncrementalUsersPage(url: string): Promise<ZendeskIncrementalUsersResponse> {
  console.log(`[ZendeskSupportUsers] Fetching incremental URL: ${url}`);
  
  return fetchWithRetry<ZendeskIncrementalUsersResponse>(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
}

function updateProgressMetrics(processed: number, created: number, updated: number, failed: number, pageNum: number, estimatedTotal: number): void {
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
  if (isSyncing) {
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
  
  isSyncing = true;
  cancelRequested = false;
  currentProgress = { processed: 0, created: 0, updated: 0, failed: 0, currentPage: 0, estimatedTotal: maxUsers || 0, usersPerMinute: 0, estimatedTimeRemainingMs: 0 };
  syncStartTime = Date.now();
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
  
  currentSyncId = syncLog.id;
  
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
      
      while (url && !cancelRequested) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching incremental page ${pageCount}...`);
        currentProgress.currentPage = pageCount;
        
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
        
        currentProgress = { ...currentProgress, processed: totalProcessed, created: totalCreated, updated: totalUpdated, failed: totalFailed };
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url && !cancelRequested) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (cancelRequested) {
        wasCancelled = true;
        console.log(`[ZendeskSupportUsers] Sync cancelled after ${totalProcessed} records`);
      }
    } else {
      console.log(`[ZendeskSupportUsers] Starting full sync...${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
      
      let url: string | null = `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
      let pageCount = 0;
      
      while (url && (!maxUsers || totalProcessed < maxUsers) && !cancelRequested) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching page ${pageCount}...`);
        currentProgress.currentPage = pageCount;
        
        const data = await fetchUsersPage(url);
        
        if (currentProgress.estimatedTotal === 0 && data.count) {
          currentProgress.estimatedTotal = maxUsers ? Math.min(maxUsers, data.count) : data.count;
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
        
        currentProgress = { ...currentProgress, processed: totalProcessed, created: totalCreated, updated: totalUpdated, failed: totalFailed };
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url && !cancelRequested) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (cancelRequested) {
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
    
    isSyncing = false;
    currentSyncId = null;
    cancelRequested = false;
    
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
    
    isSyncing = false;
    currentSyncId = null;
    
    return {
      success: false,
      message: `Erro na sincronização: ${errorMessage}`,
    };
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
  if (isSyncing) {
    return {
      success: false,
      message: "Sincronização já está em andamento",
    };
  }
  
  isSyncing = true;
  cancelRequested = false;
  currentProgress = { processed: 0, created: 0, updated: 0, failed: 0, currentPage: 0, estimatedTotal: maxUsers || 0, usersPerMinute: 0, estimatedTimeRemainingMs: 0 };
  syncStartTime = Date.now();
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
  
  currentSyncId = syncLog.id;
  
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let wasCancelled = false;
  let nextCursor: string | null = null;
  let isComplete = false;
  
  let userBuffer: InsertZendeskSupportUser[] = [];
  let lastPersistedCursor: string | null = startCursor ?? null;
  let currentFetchUrl: string | null = null;
  
  async function flushBufferWithRetry(buffer: InsertZendeskSupportUser[], maxRetries = 3): Promise<{ created: number; updated: number; success: boolean }> {
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
  
  try {
    console.log(`[ZendeskSupportUsers] Starting add-new sync...${startCursor ? ` (resuming from cursor)` : ' (from beginning)'}${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
    
    let url: string | null = startCursor || `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
    let pageCount = 0;
    let estimatedTotal = maxUsers || 0;
    let lastCheckpointPage = 0;
    
    while (url && (!maxUsers || totalProcessed < maxUsers) && !cancelRequested) {
      pageCount++;
      currentFetchUrl = url;
      
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
      
      if (url && !cancelRequested) {
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
    
    if (cancelRequested) {
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
    
    isSyncing = false;
    currentSyncId = null;
    cancelRequested = false;
    
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
    
    isSyncing = false;
    currentSyncId = null;
    
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

export { listZendeskUsers };
export type { ZendeskUserFilters };
