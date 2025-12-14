import { db } from "../../../../db.js";
import { zendeskSupportUsers, externalDataSyncLogs, type ZendeskSupportUser, type InsertZendeskSupportUser, type ExternalDataSyncLog, type InsertExternalDataSyncLog } from "../../../../../shared/schema.js";
import { eq, ilike, or, desc, and, sql, type SQL, count } from "drizzle-orm";

export interface ZendeskUserFilters {
  search?: string;
  role?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ZendeskUserListResult {
  users: ZendeskSupportUser[];
  total: number;
  limit: number;
  offset: number;
}

export async function listZendeskUsers(filters: ZendeskUserFilters = {}): Promise<ZendeskUserListResult> {
  const { search, role, active, limit = 50, offset = 0 } = filters;
  
  const conditions: SQL[] = [];
  
  if (search) {
    conditions.push(
      or(
        ilike(zendeskSupportUsers.name, `%${search}%`),
        ilike(zendeskSupportUsers.email, `%${search}%`)
      )!
    );
  }
  
  if (role) {
    conditions.push(eq(zendeskSupportUsers.role, role));
  }
  
  if (active !== undefined) {
    conditions.push(eq(zendeskSupportUsers.active, active));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [users, totalResult] = await Promise.all([
    db
      .select()
      .from(zendeskSupportUsers)
      .where(whereClause)
      .orderBy(desc(zendeskSupportUsers.zendeskUpdatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(zendeskSupportUsers)
      .where(whereClause)
  ]);
  
  return {
    users,
    total: totalResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getZendeskUserByZendeskId(zendeskId: number): Promise<ZendeskSupportUser | null> {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(eq(zendeskSupportUsers.zendeskId, zendeskId))
    .limit(1);
  
  return result[0] ?? null;
}

export async function getZendeskUserById(id: number): Promise<ZendeskSupportUser | null> {
  const result = await db
    .select()
    .from(zendeskSupportUsers)
    .where(eq(zendeskSupportUsers.id, id))
    .limit(1);
  
  return result[0] ?? null;
}

export async function upsertZendeskUser(data: InsertZendeskSupportUser): Promise<ZendeskSupportUser> {
  const result = await db
    .insert(zendeskSupportUsers)
    .values(data)
    .onConflictDoUpdate({
      target: zendeskSupportUsers.zendeskId,
      set: {
        ...data,
        updatedAt: new Date(),
      },
    })
    .returning();
  
  return result[0];
}

export async function upsertZendeskUsersBatch(users: InsertZendeskSupportUser[]): Promise<{ created: number; updated: number }> {
  if (users.length === 0) {
    return { created: 0, updated: 0 };
  }
  
  const existingIds = new Set(
    (await db
      .select({ zendeskId: zendeskSupportUsers.zendeskId })
      .from(zendeskSupportUsers)
      .where(sql`${zendeskSupportUsers.zendeskId} IN (${sql.join(users.map(u => sql`${u.zendeskId}`), sql`, `)})`)
    ).map(r => r.zendeskId)
  );
  
  const toCreate = users.filter(u => !existingIds.has(u.zendeskId));
  const toUpdate = users.filter(u => existingIds.has(u.zendeskId));
  
  if (toCreate.length > 0) {
    await db.insert(zendeskSupportUsers).values(toCreate);
  }
  
  if (toUpdate.length > 0) {
    await bulkUpdateZendeskUsers(toUpdate);
  }
  
  return { created: toCreate.length, updated: toUpdate.length };
}

async function bulkUpdateZendeskUsers(users: InsertZendeskSupportUser[]): Promise<void> {
  if (users.length === 0) return;
  
  const CHUNK_SIZE = 500;
  
  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE);
    
    const valuesClause = chunk.map((u, idx) => {
      const placeholderBase = idx * 41;
      return `($${placeholderBase + 1}::bigint, $${placeholderBase + 2}, $${placeholderBase + 3}, $${placeholderBase + 4}, $${placeholderBase + 5}, $${placeholderBase + 6}::boolean, $${placeholderBase + 7}, $${placeholderBase + 8}, $${placeholderBase + 9}::integer, $${placeholderBase + 10}::bigint, $${placeholderBase + 11}::boolean, $${placeholderBase + 12}::boolean, $${placeholderBase + 13}::boolean, $${placeholderBase + 14}::boolean, $${placeholderBase + 15}::boolean, $${placeholderBase + 16}::bigint, $${placeholderBase + 17}::bigint, $${placeholderBase + 18}, $${placeholderBase + 19}, $${placeholderBase + 20}, $${placeholderBase + 21}::integer, $${placeholderBase + 22}, $${placeholderBase + 23}, $${placeholderBase + 24}, $${placeholderBase + 25}::text[], $${placeholderBase + 26}, $${placeholderBase + 27}, $${placeholderBase + 28}::boolean, $${placeholderBase + 29}::boolean, $${placeholderBase + 30}::boolean, $${placeholderBase + 31}::boolean, $${placeholderBase + 32}::boolean, $${placeholderBase + 33}::timestamp, $${placeholderBase + 34}::timestamp, $${placeholderBase + 35}::timestamp, $${placeholderBase + 36}::jsonb, $${placeholderBase + 37}::jsonb, $${placeholderBase + 38}::timestamp, $${placeholderBase + 39}::timestamp, $${placeholderBase + 40}::timestamp, NOW())`;
    }).join(', ');
    
    const params: unknown[] = [];
    for (const u of chunk) {
      params.push(
        u.zendeskId, u.url, u.name, u.email, u.phone,
        u.sharedPhoneNumber, u.alias, u.role, u.roleType, u.customRoleId,
        u.verified, u.active, u.suspended, u.moderator, u.restrictedAgent,
        u.organizationId, u.defaultGroupId, u.timeZone, u.ianaTimeZone, u.locale,
        u.localeId, u.details, u.notes, u.signature, u.tags || [],
        u.externalId, u.ticketRestriction, u.onlyPrivateComments, u.chatOnly, u.shared,
        u.sharedAgent, u.twoFactorAuthEnabled, u.zendeskCreatedAt, u.zendeskUpdatedAt, u.lastLoginAt,
        u.userFields ? JSON.stringify(u.userFields) : null, u.photo ? JSON.stringify(u.photo) : null,
        u.syncedAt, null, null
      );
    }
    
    const updateQuery = `
      UPDATE zendesk_support_users AS t SET
        url = v.url,
        name = v.name,
        email = v.email,
        phone = v.phone,
        shared_phone_number = v.shared_phone_number,
        alias = v.alias,
        role = v.role,
        role_type = v.role_type,
        custom_role_id = v.custom_role_id,
        verified = v.verified,
        active = v.active,
        suspended = v.suspended,
        moderator = v.moderator,
        restricted_agent = v.restricted_agent,
        organization_id = v.organization_id,
        default_group_id = v.default_group_id,
        time_zone = v.time_zone,
        iana_time_zone = v.iana_time_zone,
        locale = v.locale,
        locale_id = v.locale_id,
        details = v.details,
        notes = v.notes,
        signature = v.signature,
        tags = v.tags,
        external_id = v.external_id,
        ticket_restriction = v.ticket_restriction,
        only_private_comments = v.only_private_comments,
        chat_only = v.chat_only,
        shared = v.shared,
        shared_agent = v.shared_agent,
        two_factor_auth_enabled = v.two_factor_auth_enabled,
        zendesk_created_at = v.zendesk_created_at,
        zendesk_updated_at = v.zendesk_updated_at,
        last_login_at = v.last_login_at,
        user_fields = v.user_fields,
        photo = v.photo,
        synced_at = v.synced_at,
        updated_at = v.updated_at_new
      FROM (VALUES ${valuesClause}) AS v(
        zendesk_id, url, name, email, phone,
        shared_phone_number, alias, role, role_type, custom_role_id,
        verified, active, suspended, moderator, restricted_agent,
        organization_id, default_group_id, time_zone, iana_time_zone, locale,
        locale_id, details, notes, signature, tags,
        external_id, ticket_restriction, only_private_comments, chat_only, shared,
        shared_agent, two_factor_auth_enabled, zendesk_created_at, zendesk_updated_at, last_login_at,
        user_fields, photo, synced_at, created_at, updated_at, updated_at_new
      )
      WHERE t.zendesk_id = v.zendesk_id
    `;
    
    await db.execute(sql.raw(updateQuery.replace(/\$(\d+)/g, (_, num) => {
      const val = params[parseInt(num) - 1];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      if (typeof val === 'number') return String(val);
      if (val instanceof Date) return `'${val.toISOString()}'`;
      if (Array.isArray(val)) return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]::text[]`;
      return `'${String(val).replace(/'/g, "''")}'`;
    })));
  }
}

export async function getZendeskUsersCount(): Promise<number> {
  const result = await db.select({ count: count() }).from(zendeskSupportUsers);
  return result[0]?.count ?? 0;
}

export async function createSyncLog(data: InsertExternalDataSyncLog): Promise<ExternalDataSyncLog> {
  const result = await db
    .insert(externalDataSyncLogs)
    .values(data)
    .returning();
  
  return result[0];
}

export async function updateSyncLog(
  id: number,
  data: Partial<ExternalDataSyncLog>
): Promise<ExternalDataSyncLog | null> {
  const result = await db
    .update(externalDataSyncLogs)
    .set(data)
    .where(eq(externalDataSyncLogs.id, id))
    .returning();
  
  return result[0] ?? null;
}

export async function getLatestSyncLog(sourceType: string): Promise<ExternalDataSyncLog | null> {
  const result = await db
    .select()
    .from(externalDataSyncLogs)
    .where(eq(externalDataSyncLogs.sourceType, sourceType))
    .orderBy(desc(externalDataSyncLogs.startedAt))
    .limit(1);
  
  return result[0] ?? null;
}

export async function getSyncLogs(
  sourceType: string,
  limit: number = 10
): Promise<ExternalDataSyncLog[]> {
  return db
    .select()
    .from(externalDataSyncLogs)
    .where(eq(externalDataSyncLogs.sourceType, sourceType))
    .orderBy(desc(externalDataSyncLogs.startedAt))
    .limit(limit);
}

export async function getLatestAddNewSyncLog(sourceType: string): Promise<ExternalDataSyncLog | null> {
  const result = await db
    .select()
    .from(externalDataSyncLogs)
    .where(
      and(
        eq(externalDataSyncLogs.sourceType, sourceType),
        eq(externalDataSyncLogs.syncType, "add-new")
      )
    )
    .orderBy(desc(externalDataSyncLogs.startedAt))
    .limit(1);
  
  return result[0] ?? null;
}
