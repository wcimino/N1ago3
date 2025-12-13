import { 
  upsertZendeskUsersBatch, 
  createSyncLog, 
  updateSyncLog, 
  getLatestSyncLog,
  getZendeskUsersCount,
  type ZendeskUserFilters,
  listZendeskUsers
} from "../storage/zendeskSupportUsersStorage.js";
import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";

const ZENDESK_SUBDOMAIN = "movilepay";
const SOURCE_TYPE = "zendesk-support-users";
const BATCH_SIZE = 100;

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
  const response = await fetch(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Zendesk API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchIncrementalUsersPage(url: string): Promise<ZendeskIncrementalUsersResponse> {
  const response = await fetch(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Zendesk Incremental API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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
  
  try {
    if (syncType === "incremental" && lastCompletedSync) {
      const incrementalStartTime = lastCompletedSync.finishedAt 
        ? Math.floor(lastCompletedSync.finishedAt.getTime() / 1000)
        : Math.floor(lastCompletedSync.startedAt.getTime() / 1000);
      
      console.log(`[ZendeskSupportUsers] Starting incremental sync from ${new Date(incrementalStartTime * 1000).toISOString()}...`);
      
      let url: string | null = `${getBaseUrl()}/api/v2/incremental/users.json?start_time=${incrementalStartTime}`;
      let pageCount = 0;
      
      while (url) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching incremental page ${pageCount}...`);
        
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
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      console.log(`[ZendeskSupportUsers] Starting full sync...${maxUsers ? ` (limit: ${maxUsers})` : ''}`);
      
      let url: string | null = `${getBaseUrl()}/api/v2/users.json?per_page=${BATCH_SIZE}`;
      let pageCount = 0;
      
      while (url && (!maxUsers || totalProcessed < maxUsers)) {
        pageCount++;
        console.log(`[ZendeskSupportUsers] Fetching page ${pageCount}...`);
        
        const data = await fetchUsersPage(url);
        
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
        
        await updateSyncLog(syncLog.id, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
        });
        
        url = data.next_page;
        
        if (url) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    const durationMs = Date.now() - startTime;
    
    await updateSyncLog(syncLog.id, {
      status: "completed",
      finishedAt: new Date(),
      durationMs,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed,
    });
    
    const syncTypeLabel = syncType === "incremental" ? "incremental" : "completa";
    console.log(`[ZendeskSupportUsers] ${syncTypeLabel} sync completed: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed in ${durationMs}ms`);
    
    isSyncing = false;
    currentSyncId = null;
    
    return {
      success: true,
      message: `Sincronização ${syncTypeLabel} concluída com sucesso`,
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

export { listZendeskUsers };
export type { ZendeskUserFilters };
