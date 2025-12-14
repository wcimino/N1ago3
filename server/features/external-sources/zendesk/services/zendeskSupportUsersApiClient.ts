import type { InsertZendeskSupportUser } from "../../../../../shared/schema.js";

export const ZENDESK_SUBDOMAIN = "movilepay";
export const SOURCE_TYPE = "zendesk-support-users";
export const BATCH_SIZE = 100;
export const DB_BATCH_SIZE = 500;
export const CHECKPOINT_INTERVAL = 10;
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 1000;

export interface ZendeskUserApiResponse {
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

export interface ZendeskUsersListResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

export interface ZendeskIncrementalUsersResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  end_of_stream: boolean;
  end_time: number;
  count: number;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

export function getAuthHeader(): string {
  const email = process.env.ZENDESK_SUPPORT_EMAIL;
  const apiToken = process.env.ZENDESK_SUPPORT_API_TOKEN;
  
  if (!email || !apiToken) {
    throw new Error("Missing ZENDESK_SUPPORT_EMAIL or ZENDESK_SUPPORT_API_TOKEN environment variables");
  }
  
  const credentials = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  return `Basic ${credentials}`;
}

export function getBaseUrl(): string {
  return `https://${ZENDESK_SUBDOMAIN}.zendesk.com`;
}

export function mapApiUserToDbUser(apiUser: ZendeskUserApiResponse): InsertZendeskSupportUser {
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

export async function fetchUsersPage(url: string): Promise<ZendeskUsersListResponse> {
  console.log(`[ZendeskSupportUsers] Fetching URL: ${url}`);
  
  return fetchWithRetry<ZendeskUsersListResponse>(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
}

export async function fetchIncrementalUsersPage(url: string): Promise<ZendeskIncrementalUsersResponse> {
  console.log(`[ZendeskSupportUsers] Fetching incremental URL: ${url}`);
  
  return fetchWithRetry<ZendeskIncrementalUsersResponse>(url, {
    headers: { 
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
}
