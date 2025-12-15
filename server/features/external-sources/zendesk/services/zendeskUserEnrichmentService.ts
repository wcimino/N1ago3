import { getAuthHeader, getBaseUrl, mapApiUserToDbUser, type ZendeskUserApiResponse } from "./zendeskSupportUsersApiClient.js";
import { upsertZendeskUser } from "../storage/zendeskSupportUsersStorage.js";
import { db } from "../../../../db.js";
import { zendeskSupportUsers } from "../../../../../shared/schema.js";
import { ilike } from "drizzle-orm";

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
      console.log(`[ZendeskEnrichment] No user found for email: ${email}`);
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

async function getExistingUserByEmail(email: string) {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(ilike(zendeskSupportUsers.email, email))
    .limit(1);
  return result[0] ?? null;
}

export async function enrichUserFromZendesk(email: string): Promise<boolean> {
  try {
    if (!email || !email.includes("@")) {
      console.log(`[ZendeskEnrichment] Invalid email: ${email}`);
      return false;
    }

    const existingUser = await getExistingUserByEmail(email);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (existingUser && existingUser.syncedAt && existingUser.syncedAt > oneHourAgo) {
      console.log(`[ZendeskEnrichment] User ${email} already synced recently, skipping`);
      return true;
    }

    console.log(`[ZendeskEnrichment] Searching user by email: ${email}...`);
    const apiUser = await searchUserByEmail(email);

    if (!apiUser) {
      console.log(`[ZendeskEnrichment] Could not find user with email: ${email}`);
      return false;
    }

    const dbUser = mapApiUserToDbUser(apiUser);
    await upsertZendeskUser(dbUser);

    console.log(`[ZendeskEnrichment] Successfully enriched user ${email} (zendeskId: ${apiUser.id})`);
    return true;
  } catch (error) {
    console.error(`[ZendeskEnrichment] Failed to enrich user ${email}:`, error);
    return false;
  }
}
