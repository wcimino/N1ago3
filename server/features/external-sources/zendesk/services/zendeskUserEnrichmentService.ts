import { getAuthHeader, getBaseUrl, mapApiUserToDbUser, type ZendeskUserApiResponse } from "./zendeskSupportUsersApiClient.js";
import { upsertZendeskUser } from "../storage/zendeskSupportUsersStorage.js";
import { db } from "../../../../db.js";
import { zendeskSupportUsers } from "../../../../../shared/schema.js";
import { eq, ilike } from "drizzle-orm";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface ZendeskUsersSearchResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  count: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchUserByExternalId(externalId: string): Promise<ZendeskUserApiResponse | null> {
  const url = `${getBaseUrl()}/api/v2/users/search.json?external_id=${encodeURIComponent(externalId)}`;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        console.log(`[ZendeskEnrichment] Rate limited. Waiting ${waitMs}ms before retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(waitMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }

      if (response.status >= 500) {
        console.log(`[ZendeskEnrichment] Server error (${response.status}). Retrying ${attempt}/${MAX_RETRIES}...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ZendeskEnrichment] API error: ${response.status} - ${errorBody}`);
        return null;
      }

      const data: ZendeskUsersSearchResponse = await response.json();
      if (data.users && data.users.length > 0) {
        return data.users[0];
      }
      return null;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.log(`[ZendeskEnrichment] Network error. Retrying ${attempt}/${MAX_RETRIES}...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }
      console.error(`[ZendeskEnrichment] Unexpected error:`, error);
      return null;
    }
  }

  console.error(`[ZendeskEnrichment] Max retries exceeded for external_id ${externalId}`);
  return null;
}

async function searchUserByEmail(email: string): Promise<ZendeskUserApiResponse | null> {
  const url = `${getBaseUrl()}/api/v2/users/search.json?query=email:${encodeURIComponent(email)}`;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        console.log(`[ZendeskEnrichment] Rate limited. Waiting ${waitMs}ms before retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(waitMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }

      if (response.status >= 500) {
        console.log(`[ZendeskEnrichment] Server error (${response.status}). Retrying ${attempt}/${MAX_RETRIES}...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ZendeskEnrichment] API error: ${response.status} - ${errorBody}`);
        return null;
      }

      const data: ZendeskUsersSearchResponse = await response.json();
      if (data.users && data.users.length > 0) {
        return data.users[0];
      }
      return null;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.log(`[ZendeskEnrichment] Network error. Retrying ${attempt}/${MAX_RETRIES}...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
        continue;
      }
      console.error(`[ZendeskEnrichment] Unexpected error:`, error);
      return null;
    }
  }

  console.error(`[ZendeskEnrichment] Max retries exceeded for email ${email}`);
  return null;
}

async function getExistingUserByExternalId(externalId: string) {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(eq(zendeskSupportUsers.externalId, externalId))
    .limit(1);
  return result[0] ?? null;
}

async function getExistingUserByEmail(email: string) {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(ilike(zendeskSupportUsers.email, email))
    .limit(1);
  return result[0] ?? null;
}

interface EnrichUserParams {
  externalId?: string;
  email?: string;
}

export async function enrichUserFromZendesk(params: EnrichUserParams): Promise<boolean> {
  const { externalId, email } = params;
  
  if (!externalId && !email) {
    console.log(`[ZendeskEnrichment] No externalId or email provided`);
    return false;
  }

  const identifier = externalId || email!;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    let existingUser = externalId 
      ? await getExistingUserByExternalId(externalId)
      : null;
    
    if (!existingUser && email) {
      existingUser = await getExistingUserByEmail(email);
    }
    
    if (existingUser && existingUser.syncedAt && existingUser.syncedAt > oneHourAgo) {
      console.log(`[ZendeskEnrichment] User ${identifier} already synced recently, skipping`);
      return true;
    }

    let apiUser: ZendeskUserApiResponse | null = null;
    
    if (externalId) {
      console.log(`[ZendeskEnrichment] Searching user by external_id: ${externalId}...`);
      apiUser = await searchUserByExternalId(externalId);
    }
    
    if (!apiUser && email) {
      console.log(`[ZendeskEnrichment] Searching user by email: ${email}...`);
      apiUser = await searchUserByEmail(email);
    }

    if (!apiUser) {
      console.log(`[ZendeskEnrichment] Could not find user with identifier: ${identifier}`);
      return false;
    }

    const dbUser = mapApiUserToDbUser(apiUser);
    await upsertZendeskUser(dbUser);

    console.log(`[ZendeskEnrichment] Successfully enriched user ${identifier} (zendeskId: ${apiUser.id})`);
    return true;
  } catch (error) {
    console.error(`[ZendeskEnrichment] Failed to enrich user ${identifier}:`, error);
    return false;
  }
}
